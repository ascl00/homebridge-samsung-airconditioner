#Homebridge-samsung-airconditioner

Forked from cicciovo's work. The main differences are:
 - Deals with multiple devices exposed by the wifi controller by searching for the first one that actually has the info we need
 - Removes cURL and uses native nodejs requests
 - Uses a single status update call, and protects it to avoid spamming calls
 - Ensures the app is not held up waiting for updates by caching state

 Big thanks to cicciovo for the intial plugin.


Samsung Airconditioenr plugin for [Homebridge]

This allows you to control your Samsung Airconditioner with HomeKit and Siri.

THIS SCRIPT FOR NOW WORKS ONLY WITH THE AC WITH THE PORT NUMBER 8888 AND NOT WITH THE PORT 2878

##Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: sudo npm install -g homebridge-samsung-airconditioner
3. To obtain a token run in a shell window the file Server8889.py: python Server8889.py

	3.1 Open another shell window, copy and past the command: 
curl -k -H "Content-Type: application/json" -H "DeviceToken: xxxxxxxxxxx" --cert /usr/local/lib/node_modules/homebridge-samsung-airconditioner/ac14k_m.pem --insecure -X POST https://192.168.1.152:8888/devicetoken/request

	3.2 In this string change 192.168.1.152 with the ip of your Airconditioner

	3.3 Send the command

	3.4 Turn On your AC

	3.5 In the window where are running the file Server8889.py should be appare the TOKEN, copy and past it in your config.json

NOTE: The above method did not work for me. Using the reset button the controller, making the curl request, and then manually pressing the "AP" button on the controller was what did the trick. It isn't super reliable so you may need to try a few times

4. Update your configuration file. See `config.json`.

	5.1 Change the ip with the ip of your AC

	5.2 Change the token with the token obtain in step 3

	5.3 if necessary change the patchCert
	
5. If you obtain an Nan error see if your AC is connected to the wifi.

