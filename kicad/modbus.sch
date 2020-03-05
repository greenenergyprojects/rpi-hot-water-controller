EESchema Schematic File Version 4
LIBS:rpi-hot-water-controller-cache
EELAYER 26 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 3 3
Title "RPI Hot water controller"
Date "2018-10-12"
Rev "0.1"
Comp "github.com/greenenergyprojects"
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L rpi-hot-water-controller-rescue:SN65HVD11 U8
U 1 1 5BB6AE04
P 4500 3300
F 0 "U8" H 4260 3750 50  0000 C CNN
F 1 "SN65HVD11" H 4530 3750 50  0000 L CNN
F 2 "Project:SOIC-8_3.9x4.9mm_Pitch1.27mm_Handsolded" H 4500 2600 50  0001 C CNN
F 3 "" H 4500 3350 50  0001 C CNN
	1    4500 3300
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:D_TVS_x2_AAC-RESCUE-rpi-atmega324-modbus-x3-gateway D1
U 1 1 5BB6AE81
P 6900 3300
F 0 "D1" H 6900 3475 50  0000 C CNN
F 1 "D_TVS_x2_AAC-RESCUE-rpi-atmega324-modbus-x3-gateway" H 6900 3400 50  0001 C CNN
F 2 "TO_SOT_Packages_SMD:SOT-23_Handsoldering" H 6750 3300 50  0001 C CNN
F 3 "" H 6750 3300 50  0001 C CNN
	1    6900 3300
	0    -1   -1   0   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:Screw_Terminal_01x02 J1
U 1 1 5BB6B128
P 8000 3300
F 0 "J1" H 8000 3400 50  0000 C CNN
F 1 "Modbus" H 8200 3250 50  0000 C CNN
F 2 "Project:Terminalblock-2x-5,08mm_ebay-273426629807" H 8000 3300 50  0001 C CNN
F 3 "" H 8000 3300 50  0001 C CNN
	1    8000 3300
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:LED D17
U 1 1 5BB6B79D
P 2900 2450
F 0 "D17" V 2900 2550 50  0000 C CNN
F 1 "RX" H 3100 2600 50  0001 C CNN
F 2 "LEDs:LED_0805_HandSoldering" H 2900 2450 50  0001 C CNN
F 3 "" H 2900 2450 50  0001 C CNN
	1    2900 2450
	0    -1   -1   0   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:C_Small C16
U 1 1 5BB6C6ED
P 4800 2600
F 0 "C16" V 4650 2400 50  0000 L CNN
F 1 "100n" V 4650 2650 50  0000 L CNN
F 2 "Capacitors_SMD:C_1206_HandSoldering" H 4800 2600 50  0001 C CNN
F 3 "" H 4800 2600 50  0001 C CNN
	1    4800 2600
	0    1    1    0   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:Conn_01x02 J17
U 1 1 5BB6C710
P 6500 3100
F 0 "J17" H 6500 3200 50  0000 C CNN
F 1 "Conn_01x02" H 6500 2900 50  0001 C CNN
F 2 "Pin_Headers:Pin_Header_Straight_1x02_Pitch2.54mm" H 6500 3100 50  0001 C CNN
F 3 "" H 6500 3100 50  0001 C CNN
	1    6500 3100
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:Conn_01x03 J16
U 1 1 5BB6C903
P 5300 2300
F 0 "J16" H 5300 2500 50  0000 C CNN
F 1 "Conn_01x03" H 5300 2100 50  0001 C CNN
F 2 "Pin_Headers:Pin_Header_Straight_1x03_Pitch2.54mm" H 5300 2300 50  0001 C CNN
F 3 "" H 5300 2300 50  0001 C CNN
	1    5300 2300
	0    -1   -1   0   
$EndComp
$Comp
L power:GND #PWR089
U 1 1 5BB6CF96
P 5200 2700
F 0 "#PWR089" H 5200 2450 50  0001 C CNN
F 1 "GND" H 5200 2550 50  0000 C CNN
F 2 "" H 5200 2700 50  0001 C CNN
F 3 "" H 5200 2700 50  0001 C CNN
	1    5200 2700
	1    0    0    -1  
$EndComp
$Comp
L power:+3V3 #PWR090
U 1 1 5BB6CF9C
P 6600 1900
F 0 "#PWR090" H 6600 1750 50  0001 C CNN
F 1 "+3V3" H 6600 2040 50  0000 C CNN
F 2 "" H 6600 1900 50  0001 C CNN
F 3 "" H 6600 1900 50  0001 C CNN
	1    6600 1900
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R57
U 1 1 5BB6D226
P 5750 3200
F 0 "R57" V 5650 3200 50  0000 C CNN
F 1 "10R" V 5750 3200 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 5680 3200 50  0001 C CNN
F 3 "" H 5750 3200 50  0001 C CNN
	1    5750 3200
	0    1    1    0   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R58
U 1 1 5BB6D27F
P 5750 3500
F 0 "R58" V 5650 3500 50  0000 C CNN
F 1 "10R" V 5750 3500 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 5680 3500 50  0001 C CNN
F 3 "" H 5750 3500 50  0001 C CNN
	1    5750 3500
	0    1    1    0   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R19
U 1 1 5BB6D3E3
P 6200 3450
F 0 "R19" H 6100 3450 50  0000 C CNN
F 1 "150R" V 6200 3450 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 6130 3450 50  0001 C CNN
F 3 "" H 6200 3450 50  0001 C CNN
	1    6200 3450
	-1   0    0    1   
$EndComp
$Comp
L power:GND #PWR091
U 1 1 5BB6D5DC
P 7200 3400
F 0 "#PWR091" H 7200 3150 50  0001 C CNN
F 1 "GND" H 7200 3250 50  0000 C CNN
F 2 "" H 7200 3400 50  0001 C CNN
F 3 "" H 7200 3400 50  0001 C CNN
	1    7200 3400
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:Conn_01x02 J19
U 1 1 5BB6D628
P 6900 4100
F 0 "J19" H 6900 4200 50  0000 C CNN
F 1 "Conn_01x02" H 6900 3900 50  0001 C CNN
F 2 "Pin_Headers:Pin_Header_Straight_1x02_Pitch2.54mm" H 6900 4100 50  0001 C CNN
F 3 "" H 6900 4100 50  0001 C CNN
	1    6900 4100
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:Conn_01x02 J18
U 1 1 5BB6D686
P 6900 2400
F 0 "J18" H 6900 2500 50  0000 C CNN
F 1 "Conn_01x02" H 6900 2200 50  0001 C CNN
F 2 "Pin_Headers:Pin_Header_Straight_1x02_Pitch2.54mm" H 6900 2400 50  0001 C CNN
F 3 "" H 6900 2400 50  0001 C CNN
	1    6900 2400
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R16
U 1 1 5BB6D7D3
P 6600 4450
F 0 "R16" H 6500 4450 50  0000 C CNN
F 1 "330R" V 6600 4450 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 6530 4450 50  0001 C CNN
F 3 "" H 6600 4450 50  0001 C CNN
	1    6600 4450
	-1   0    0    1   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R15
U 1 1 5BB6D828
P 6600 2150
F 0 "R15" H 6500 2150 50  0000 C CNN
F 1 "330R" V 6600 2150 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 6530 2150 50  0001 C CNN
F 3 "" H 6600 2150 50  0001 C CNN
	1    6600 2150
	-1   0    0    1   
$EndComp
$Comp
L power:+3V3 #PWR092
U 1 1 5BB6DABD
P 4500 2300
F 0 "#PWR092" H 4500 2150 50  0001 C CNN
F 1 "+3V3" H 4500 2440 50  0000 C CNN
F 2 "" H 4500 2300 50  0001 C CNN
F 3 "" H 4500 2300 50  0001 C CNN
	1    4500 2300
	1    0    0    -1  
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R6
U 1 1 5BB6DD86
P 2900 2850
F 0 "R6" H 3000 2850 50  0000 C CNN
F 1 "560R" V 2900 2850 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 2830 2850 50  0001 C CNN
F 3 "" H 2900 2850 50  0001 C CNN
	1    2900 2850
	-1   0    0    1   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:LED D18
U 1 1 5BB6DEBF
P 3100 2450
F 0 "D18" V 3100 2350 50  0000 C CNN
F 1 "TX" H 3300 2600 50  0001 C CNN
F 2 "LEDs:LED_0805_HandSoldering" H 3100 2450 50  0001 C CNN
F 3 "" H 3100 2450 50  0001 C CNN
	1    3100 2450
	0    -1   -1   0   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R9
U 1 1 5BB6DEC6
P 3100 2850
F 0 "R9" H 3000 2850 50  0000 C CNN
F 1 "560R" V 3100 2850 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 3030 2850 50  0001 C CNN
F 3 "" H 3100 2850 50  0001 C CNN
	1    3100 2850
	-1   0    0    1   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R54
U 1 1 5BB6DFF4
P 3600 2850
F 0 "R54" H 3500 2850 50  0000 C CNN
F 1 "47k" V 3600 2850 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 3530 2850 50  0001 C CNN
F 3 "" H 3600 2850 50  0001 C CNN
	1    3600 2850
	-1   0    0    1   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R55
U 1 1 5BB6DFFB
P 3800 2850
F 0 "R55" H 3700 2850 50  0000 C CNN
F 1 "47k" V 3800 2850 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 3730 2850 50  0001 C CNN
F 3 "" H 3800 2850 50  0001 C CNN
	1    3800 2850
	-1   0    0    1   
$EndComp
$Comp
L rpi-hot-water-controller-rescue:R R56
U 1 1 5BB6E028
P 3800 3850
F 0 "R56" H 3700 3850 50  0000 C CNN
F 1 "47k" V 3800 3850 50  0000 C CNN
F 2 "Resistors_SMD:R_1206_HandSoldering" V 3730 3850 50  0001 C CNN
F 3 "" H 3800 3850 50  0001 C CNN
	1    3800 3850
	-1   0    0    1   
$EndComp
$Comp
L power:+3V3 #PWR093
U 1 1 5BB6E094
P 3000 2100
F 0 "#PWR093" H 3000 1950 50  0001 C CNN
F 1 "+3V3" H 3000 2240 50  0000 C CNN
F 2 "" H 3000 2100 50  0001 C CNN
F 3 "" H 3000 2100 50  0001 C CNN
	1    3000 2100
	1    0    0    -1  
$EndComp
$Comp
L power:GND #PWR094
U 1 1 5BB6E0DB
P 4500 4100
F 0 "#PWR094" H 4500 3850 50  0001 C CNN
F 1 "GND" H 4500 3950 50  0000 C CNN
F 2 "" H 4500 4100 50  0001 C CNN
F 3 "" H 4500 4100 50  0001 C CNN
	1    4500 4100
	1    0    0    -1  
$EndComp
$Comp
L power:GND #PWR095
U 1 1 5BB6E122
P 3800 4200
F 0 "#PWR095" H 3800 3950 50  0001 C CNN
F 1 "GND" H 3800 4050 50  0000 C CNN
F 2 "" H 3800 4200 50  0001 C CNN
F 3 "" H 3800 4200 50  0001 C CNN
	1    3800 4200
	1    0    0    -1  
$EndComp
$Comp
L power:+3V3 #PWR096
U 1 1 5BB6E169
P 3700 2500
F 0 "#PWR096" H 3700 2350 50  0001 C CNN
F 1 "+3V3" H 3700 2640 50  0000 C CNN
F 2 "" H 3700 2500 50  0001 C CNN
F 3 "" H 3700 2500 50  0001 C CNN
	1    3700 2500
	1    0    0    -1  
$EndComp
Text HLabel 2400 3200 0    60   Output ~ 0
RO
$Comp
L power:GND #PWR097
U 1 1 5BB6F675
P 6600 4700
F 0 "#PWR097" H 6600 4450 50  0001 C CNN
F 1 "GND" H 6600 4550 50  0000 C CNN
F 2 "" H 6600 4700 50  0001 C CNN
F 3 "" H 6600 4700 50  0001 C CNN
	1    6600 4700
	1    0    0    -1  
$EndComp
Text Label 7100 2800 0    60   ~ 0
Modbus-A
Text Label 7100 3800 0    60   ~ 0
Modbus-B
Text Label 5000 3200 0    60   ~ 0
MB-A
Text Label 5000 3500 0    60   ~ 0
MB-B
Text HLabel 2400 3300 0    60   Input ~ 0
~RE~
Text HLabel 2400 3400 0    60   Input ~ 0
DE
Text HLabel 2400 3500 0    60   Input ~ 0
DI
Wire Wire Line
	2400 3200 4100 3200
Wire Wire Line
	2400 3300 4100 3300
Wire Wire Line
	2400 3400 4100 3400
Wire Wire Line
	2400 3500 4100 3500
Wire Wire Line
	2900 3200 2900 3000
Connection ~ 2900 3200
Connection ~ 3100 3500
Wire Wire Line
	2900 2700 2900 2600
Wire Wire Line
	3100 2700 3100 2600
Wire Wire Line
	2900 2300 2900 2200
Wire Wire Line
	2900 2200 3100 2200
Wire Wire Line
	3100 2200 3100 2300
Wire Wire Line
	3000 2200 3000 2100
Connection ~ 3000 2200
Wire Wire Line
	3600 2700 3600 2600
Wire Wire Line
	3600 2600 3800 2600
Wire Wire Line
	3800 2600 3800 2700
Wire Wire Line
	3700 2600 3700 2500
Connection ~ 3700 2600
Wire Wire Line
	3600 3500 3600 3000
Connection ~ 3600 3500
Wire Wire Line
	3800 3300 3800 3000
Connection ~ 3800 3300
Wire Wire Line
	3800 3400 3800 3700
Connection ~ 3800 3400
Wire Wire Line
	3800 4000 3800 4200
Wire Wire Line
	4500 3900 4500 4100
Wire Wire Line
	4500 2300 4500 2800
Wire Wire Line
	4500 2600 4700 2600
Connection ~ 4500 2600
Wire Wire Line
	4900 2600 5200 2600
Wire Wire Line
	5200 2500 5200 2700
Connection ~ 5200 2600
Wire Wire Line
	5900 3200 6000 3200
Wire Wire Line
	6000 2800 7700 2800
Wire Wire Line
	7700 2800 7700 3300
Wire Wire Line
	7700 3300 7800 3300
Wire Wire Line
	5900 3500 6000 3500
Wire Wire Line
	6000 3800 7700 3800
Wire Wire Line
	7700 3800 7700 3400
Wire Wire Line
	7700 3400 7800 3400
Wire Wire Line
	6000 3500 6000 3800
Wire Wire Line
	6000 3200 6000 2800
Wire Wire Line
	6200 2800 6200 3100
Wire Wire Line
	6200 3100 6300 3100
Connection ~ 6200 2800
Wire Wire Line
	6300 3200 6200 3200
Wire Wire Line
	6200 3200 6200 3300
Wire Wire Line
	6200 3600 6200 3800
Connection ~ 6200 3800
Wire Wire Line
	6900 2900 6900 2800
Connection ~ 6900 2800
Wire Wire Line
	6900 3800 6900 3700
Connection ~ 6900 3800
Wire Wire Line
	7100 3300 7200 3300
Wire Wire Line
	7200 3300 7200 3400
Wire Wire Line
	6700 4100 6600 4100
Wire Wire Line
	6600 4100 6600 3800
Connection ~ 6600 3800
Wire Wire Line
	6700 4200 6600 4200
Wire Wire Line
	6600 4200 6600 4300
Wire Wire Line
	6700 2500 6600 2500
Wire Wire Line
	6600 2500 6600 2800
Connection ~ 6600 2800
Wire Wire Line
	6700 2400 6600 2400
Wire Wire Line
	6600 2400 6600 2300
Wire Wire Line
	6600 2000 6600 1900
Wire Wire Line
	6600 4700 6600 4600
Wire Wire Line
	3100 3000 3100 3500
Connection ~ 5400 3500
Wire Wire Line
	4900 3500 5600 3500
Wire Wire Line
	4900 3200 5600 3200
Connection ~ 5300 3200
Wire Wire Line
	5400 2500 5400 3500
Wire Wire Line
	5300 2500 5300 3200
$EndSCHEMATC
