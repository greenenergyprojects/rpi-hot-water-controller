# rpi-hot-water-controller

This project implements a controller for a hot water boiler (for example the [Austria Email EKR-150U](http://www.austria-email.at/produkte/haengespeicher/register-haengespeicher-ekr/))

The controller is based on a Raspberry PI for high level features like WLAN access an security issues. 
For real time controlling functions the Atmega ATmega324P is used, which has a communication link to the Raspberry via it's UART0 interface.
The microcontroller also implements a Modbus interface via it's UART1 interface.

**Features:**

* Built in 230V/5W supply
* Raspberry PI supporting Ethernet or WLAN access and high level programming
* 1 Microcontroller (Atmgea324P) supporting Modbus RTU (or Modbus-ASCII) and real time programming
* Measurment for temperature sensor inside boiler (PT1000)
* 4-20mA interface for thyristor phase control circuit (for example [Schäcke P0000113](https://www.schaecke.at/aus/Kategorien/Steuern-%26-Regeln/Sch%C3%BCtze-%26-Relais/Halbleiterrelais/Wallner-Automation-Leistungssteller-Thyristor-LS1-3%2C6-230V-40-A-4-20-mA-inkl-KK/p/4122046)) used for smart electric heater control
* Additional sensor interfaces (2x flow sensors 5V/digital pulse, 1x PT1000)
* Four solid state relais for 230V/2A
* Interface for four external LEDs or buttons.
* For DIN-rail housing [Camdenboss CBRPP-DR-CLR](https://www.camdenboss.com/camden-boss/cbrpi-dr-2-3-clr-pi-b%2c-p2%2c-p3-din-rail-enclosure/c-23/p-16101)  
(W x H x D = 88mm x 90mm x 58mm; 4.8 DIN rails units)

