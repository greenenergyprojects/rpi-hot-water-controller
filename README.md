# rpi-hot-water-controller

This project implements a controller for a hot water boiler (for example the [Austria Email EKR-150U](http://www.austria-email.at/produkte/haengespeicher/register-haengespeicher-ekr/))

The controller is based on a Raspberry PI for high level features like WLAN access an security issues. 
For real time controlling functions the Atmega ATmega324P is used, which has a communication link to the Raspberry via it's UART0 interface.
The microcontroller also implements a Modbus interface via it's UART1 interface.

**Features:**

* Built in 230V supply
* Raspberry PI supporting Ethernet or WLAN access and high level programming
* 1 Microcontroller (Atmgea324P) supporting Modbus RTU (or Modbus-ASCII) and real time programming
* Measurment for temperature sensor inside boiler
* 4-20mA interface for thyristor phase control circuit (electric heater control)
* Additional sensor interfaces (flow sensor, ...)
* For DIN-rail housing [Camdenboss CBRPP-DR-CLR](https://www.camdenboss.com/camden-boss/cbrpi-dr-2-3-clr-pi-b%2c-p2%2c-p3-din-rail-enclosure/c-23/p-16101)  
(W x H x D = 88mm x 90mm x 58mm; 4.8 DIN rails units)

