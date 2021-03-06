.PHONY: clean all

$(shell mkdir -p dist >/dev/null)
$(shell mkdir -p build >/dev/null)

## General Flags
MCU = atmega324p
PROJECT = bootloader_$(MCU)
SOURCE = $(PROJECT).c

# BOOTLOADER 2048 Byte
# BOOTADDR = 0x7800
# TEXTSTART = 0x7800
# TABLESTART = 0x7fc4
# HFUSE = 0xd2

# BOOTLOADER 4096 Byte
BOOTADDR = 0x7000
TEXTSTART = 0x7000
TABLESTART = 0x7fc0
HFUSE = 0xd0

## Compile options
CFLAGS = -mmcu=$(MCU)
CFLAGS += -Wall -gdwarf-2 -std=gnu99 -Os -funsigned-char -funsigned-bitfields -fpack-struct -fshort-enums -DBOOTADR=$(BOOTADDR)
#CFLAGS += -MD -MP -MT $(*F).o -MF dep/$(@F).d 

## Linker flagsq
LDFLAGS = -mmcu=$(MCU)
LDFLAGS +=  -Wl,-Map=bootloader_Atmega324P.map
LDFLAGS += -Wl,-section-start=.text=$(TEXTSTART)
LDFLAGS += -Wl,-section-start=.table=$(TABLESTART)

## Objects explicitly added by the user
LINKONLYOBJECTS =

## Intel Hex file production flags
HEX_FLASH_FLAGS = -R .eeprom -R .fuse -R .lock -R .signature

all: dist/$(PROJECT)_115200_12MHz_uart0.hex dist/$(PROJECT)_115200_12MHz_uart1.hex dist/$(PROJECT)_115200_12MHz_uart01.hex
	@avr-size --mcu=atmega324p --format=avr dist/$(PROJECT)_115200_12MHz_uart0.elf
	@echo "  Use 'make flash' to flash bootloader for UART1"
	@echo "  Use 'make uart0' to flash bootloader for UART0"
	@echo ""
	
dist/$(PROJECT)_115200_12MHz_uart0.hex: dist/$(PROJECT)_115200_12MHz_uart0.elf
	avr-objcopy -O ihex $(HEX_FLASH_FLAGS)  $< $@

dist/$(PROJECT)_115200_12MHz_uart1.hex: dist/$(PROJECT)_115200_12MHz_uart1.elf
	avr-objcopy -O ihex $(HEX_FLASH_FLAGS)  $< $@

dist/$(PROJECT)_115200_12MHz_uart01.hex: dist/$(PROJECT)_115200_12MHz_uart01.elf
	avr-objcopy -O ihex $(HEX_FLASH_FLAGS)  $< $@

dist/$(PROJECT)_115200_12MHz_uart0.elf: build/$(PROJECT)_115200_12MHz_uart0.o
	avr-gcc $(LDFLAGS) $(LINKONLYOBJECTS) $(LIBDIRS) $(LIBS) -o $@ $<

dist/$(PROJECT)_115200_12MHz_uart1.elf: build/$(PROJECT)_115200_12MHz_uart1.o
	avr-gcc $(LDFLAGS) $(LINKONLYOBJECTS) $(LIBDIRS) $(LIBS) -o $@ $<

dist/$(PROJECT)_115200_12MHz_uart01.elf: build/$(PROJECT)_115200_12MHz_uart01.o
	avr-gcc $(LDFLAGS) $(LINKONLYOBJECTS) $(LIBDIRS) $(LIBS) -o $@ $<

build/$(PROJECT)_115200_12MHz_uart0.o: src/$(PROJECT).c
	avr-gcc $(INCLUDES) $(CFLAGS) -DBAUDRATE=115200 -DF_CPU=12000000L -DUART0 -c  -o $@ $<

build/$(PROJECT)_115200_12MHz_uart1.o: src/$(PROJECT).c
	avr-gcc $(INCLUDES) $(CFLAGS) -DBAUDRATE=115200 -DF_CPU=12000000L -DUART1 -c  -o $@ $<

build/$(PROJECT)_115200_12MHz_uart01.o: src/$(PROJECT).c
	avr-gcc $(INCLUDES) $(CFLAGS) -DBAUDRATE=115200 -DF_CPU=12000000L -DUART1 -DUART0 -c  -o $@ $<


flash: all
	avrdude -c usbasp -p atmega324p -e -U flash:w:dist/$(PROJECT)_115200_12MHz_uart1.hex:i

uart0: all
	avrdude -c usbasp -p atmega324p -e -U flash:w:dist/$(PROJECT)_115200_12MHz_uart0.hex:i

uart01: all
	avrdude -c usbasp -p atmega324p -e -U flash:w:dist/$(PROJECT)_115200_12MHz_uart01.hex:i


# http://www.engbedded.com/fusecalc/
fuse: 
	avrdude -c usbasp -p atmega324p -U lfuse:w:0xfe:m -U hfuse:w:$(HFUSE):m
	avrdude -c usbasp -p atmega324p -U efuse:w:0xfe:m

read:
	avrdude -c usbasp -p atmega324p -U flash:r:flash.bin:r

help:
	-@echo "   make all"
	-@echo "   make flash"
	-@echo "   make uart0"
	-@echo "   make clean"
	-@echo "   make fuse"
	-@echo "   make read"

clean:
	-@rm -r dist
	-@rm -r build
	-@rm -r flash.bin
