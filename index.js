var Service, Characteristic;
var exec2 = require("child_process").exec;
require('tls').DEFAULT_MIN_VERSION = 'TLSv1';
var https = require('https');
var fs    = require('fs');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    //UUIDGen = homebridge.hap.uuid;
    homebridge.registerAccessory("homebridge-samsung-airconditioner", "SamsungAirconditioner", SamsungAirco);
};

function SamsungAirco(log, config) {
    this.log=log;
    this.name= config["name"];
    this.ip=config["ip"];
    this.token=config["token"];
    this.patchCert=config["patchCert"];
    this.accessoryName=config["name"];
    this.url='https://'+this.ip+':8888/';

    // Initial state values
    this.power       = Characteristic.Active.INACTIVE;
    this.currentTemp = 18;
    this.desiredTemp = 18;
    this.tempUnits   = Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.targetMode  = Characteristic.TargetHeaterCoolerState.AUTO;
    this.currentMode = Characteristic.CurrentHeaterCoolerState.INACTIVE;
    this.deviceId=0;

    this.stateCheckUnderway=false;
}



SamsungAirco.prototype = {
    
sendRequest: function(method, path, body, callback) {
    var options = {
        hostname: this.ip,
        port: 8888,
        path: path,
        method: method,
        rejectUnauthorized: false,
        cert: fs.readFileSync(this.patchCert),
        key: fs.readFileSync(this.patchCert),
        headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json',
        },
    };
    
    this.log("sendRequest("+method+","+path+","+body+")");

    //this.log("curl -s -k -H 'Authorization: Bearer " + this.token + "' -H 'Content-Type: application/json' --cert " + this.patchCert + 
    //                    " https://"+options.hostname+":"+options.port+path+" -X "+method + (typeof body === 'undefined' ? "" : " -d '"+body+"'"));

    var req = https.request(options, (res) => {
        res.on('data', (d) => callback(null, d));
    });
    
    req.setTimeout(10000);
    req.on('error', (e) => {
        if (e.code === 'ECONNRESET') 
        {
            this.log("Got ECONNRESET, retrying...:");
            this.sendRequest(method, path, body, callback);
            return;
        }
        this.log("Got error: " + e.code); 
        callback(e)
    });

    if(typeof body !== 'undefined')
    {
        req.setHeader('Content-Length', Buffer.byteLength(body));
        //this.log("Writing body: " + body + " with content length: " + Buffer.byteLength(body)); 
        req.write(body, 'utf8');
    }

    req.end();
},

identify: function(callback) {
    this.log("Identify!");
    callback(); // success
},
    
updateState: function() {
    if(this.stateCheckUnderway)
    {
        return;
    }
    else
    {
        this.stateCheckUnderway = true;
    }

    this.sendRequest('GET', '/devices/', undefined, function(error, message) {
        if(error) 
        {
            this.log("getState failed: " + error);
            this.stateCheckUnderway = false;
            return;
        }
        var json = JSON.parse(message);
        var json = JSON.parse(message);
        var deviceId;
        var d;
        for(i in json.Devices)
        {
            d=json.Devices[i];

            if(typeof d.Mode        === 'undefined' ||
                typeof d.Operation  === 'undefined' ||
                typeof d.Wind       === 'undefined')
            {
                continue;
            }
            deviceId = d.id;
            if(this.deviceId == 0)
            {
                this.deviceId = deviceId;
            }
        }
        
        if(typeof deviceId === 'undefined')
        {
            process.stderr.write("Failed to find valid device\n");
            this.stateCheckUnderway = false;
            return;
        }

        var tempUnits   = d.Temperatures[0].unit;
        var mode        = d.Mode.modes[0];

        this.power       = d.Operation.power === 'On' ? Characteristic.Active.ACTIVE 
                                    : Characteristic.Active.INACTIVE;
        this.currentTemp = parseInt(d.Temperatures[0].current);
        this.desiredTemp = parseInt(d.Temperatures[0].desired);

        this.tempUnits   = d.Temperatures[0].unit === 'Celsius' ? Characteristic.TemperatureDisplayUnits.CELSIUS 
                                    : Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

        this.targetMode  = d.Mode.modes[0] === 'Opmode_Cool' ? Characteristic.TargetHeaterCoolerState.COOL 
                                    : d.Mode.modes[0] === 'Opmode_Heat' ? Characteristic.TargetHeaterCoolerState.HEAT 
                                    : Characteristic.TargetHeaterCoolerState.AUTO ;

        this.currentMode = d.Mode.modes[0] === 'Opmode_Cool' ? Characteristic.CurrentHeaterCoolerState.COOLING 
                                    : d.Mode.modes[0] === 'Opmode_Heat' ? Characteristic.CurrentHeaterCoolerState.HEATING 
                                    : d.Mode.modes[0] === 'Opmode_Auto' ? Characteristic.CurrentHeaterCoolerState.IDLE 
                                    : Characteristic.CurrentHeaterCoolerState.INACTIVE ;


        this.log("updateState: " + this.power == 0 ? "On" : "Off"
            + " - " + this.currentTemp + " - " + this.desiredTemp + " - " + this.tempUnits + ": " 
            + this.targetMode + " " + this.currentMode);

        this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(this.desiredTemp);
        this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(this.desiredTemp);
        this.service.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.currentTemp);
        this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits).updateValue(this.tempUnits);
        this.service.getCharacteristic(Characteristic.Active).updateValue(this.power);

        this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(this.targetMode);
                                            
        this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(this.currentMode);

        this.stateCheckUnderway = false;
    }.bind(this));
},

getServices: function() {
    
    this.service = new Service.HeaterCooler(this.name);
        
    this.service.getCharacteristic(Characteristic.Active)
                .on('get',this.getActive.bind(this))
                .on('set', this.setActive.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
                  minValue: 0,
                  maxValue: 100,
                  minStep: 0.01
                  })
        .on('get', this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState).on('get',this.getTargetMode.bind(this)).on('set', this.setTargetMode.bind(this));
        
    this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState).on('get', this.getCurrentHeaterCoolerState.bind(this));
        
    this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
        .setProps({
                  minValue: 18,
                  maxValue: 30,
                  minStep: 1
                  })
        .on('get', this.getHeatingTargetTemperature.bind(this))
        .on('set', this.setHeatingTargetTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
        .setProps({
                  minValue: 18,
                  maxValue: 30,
                  minStep: 1
                  })
        .on('get', this.getCoolingTargetTemperature.bind(this))
        .on('set', this.setCoolingTargetTemperature.bind(this));
        
    var informationService = new Service.AccessoryInformation();
      

    return [informationService, this.service];
    
},
    
//services
getHeatingTargetTemperature: function(callback) {
    callback(null, this.desiredTemp);
    this.updateState();
},
    
setHeatingTargetTemperature: function(temp, callback) {
    this.log("setTargetTemperature");
    this.sendRequest('PUT', '/devices/'+this.deviceId+'/Temperatures/0', '{"Temperature" : { "desired":'+temp+'}}', function(error, message) {
        if(error) 
        {
            this.log("setHeatingTargetTemperature failed: " + error);
        }
        else
        {
            this.log("setHeatingTargetTemperature: " + temp);
        }
    }.bind(this));
    callback();
}, 
    
getCoolingTargetTemperature: function(callback) {
    callback(null, this.desiredTemp);
    this.updateState();
},
    
setCoolingTargetTemperature: function(temp, callback) {
    this.log("setTargetTemperature");
    this.sendRequest('PUT', '/devices/'+this.deviceId+'/Temperatures/0', '{"Temperature" : { "desired":'+temp+'}}', function(error, message) {
        if(error) {
            this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(error);
            this.log("setCoolingTargetTemperature failed: " + error);
        } else {
            this.log("setCoolingTargetTemperature: " + temp);
        }
    }.bind(this));
    callback();
},
    
getCurrentHeaterCoolerState: function (callback) {
    //this.log("getCurrentHeaterCoolerState");
    callback(null, this.currentMode);
    this.updateState();
},
    
getCurrentTemperature: function(callback) {
    //this.log("getCurrentTemperature");
    callback(null, this.currentTemp);
    this.updateState();
},
    
    
getActive: function(callback) {
    //this.log("getActive");
    callback(null, this.power);
    this.updateState();
},
    
setActive: function(state, callback) {
    var temp = state == Characteristic.Active.ACTIVE ? "On" : "Off";
    this.log("setActive: " + temp);

    this.sendRequest('PUT', '/devices/'+this.deviceId+'/Operation', '{"Operation" : { "power":"'+temp+'"}}', function(error, message) {
        if(error) {
            this.service.getCharacteristic(Characteristic.Active).updateValue(error);
            this.log("setActive failed: " + error);
        } else {
            this.log("setActive success: " + temp);
        }
    }.bind(this));

    callback();
},
    
setPowerState: function(powerOn, callback) {
    this.setActive(powerOn, callback);
},
    
getTargetMode: function(callback) {
    //this.log("getTargetMode");
    callback(null, this.targetMode);

    this.updateState();
},

setTargetMode: function(state, callback) {
    this.log("setTargetMode");
    var temp;
    callback();
    switch (state){
        case Characteristic.TargetHeaterCoolerState.COOL:
            temp = "Opmode_Cool";
            break;
        case Characteristic.TargetHeaterCoolerState.HEAT:
            temp = "Opmode_Heat";
            break;
        case Characteristic.TargetHeaterCoolerState.AUTO:
            temp = "Opmode_Auto";
            break;
    }

    if(typeof temp === 'undefined')
    {
        this.log("setTargetMode: Unknown state passed:" + state);
        return;
    }
    else
    {
        this.log("setTargetMode: setting mode to: " + temp);
    }
    
    this.sendRequest('PUT', '/devices/'+this.deviceId+'/Mode', '{"Mode" : { "modes":["'+temp+'"]}}', function(error, message) {
        if(error) {
            this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(error);
        } else {
            this.log("setActive: " + temp);
        }
    }.bind(this));
}    
};

