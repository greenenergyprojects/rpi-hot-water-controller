.PHONY: clean all

$(shell mkdir -p dist >/dev/null)
$(shell mkdir -p build >/dev/null)

all: dist/atmega324p_u1.hex
	@avr-size --mcu=atmega324p --format=avr dist/atmega324p_u1.elf


dist/atmega324p_u1.hex: dist/atmega324p_u1.elf
	avr-objcopy -O ihex $< $@

dist/atmega324p_u1.elf: build/main.o build/sys.o build/app.o build/modbus_ascii.o build/modbus.o
	avr-gcc -o $@ -mmcu=atmega324p build/main.o build/sys.o build/app.o build/modbus_ascii.o build/modbus.o

build/main.o: src/main.c src/global.h src/sys.h src/app.h
	avr-gcc -o $@ -mmcu=atmega324p -Os -c src/main.c

build/sys.o: src/sys.c src/global.h src/sys.h src/modbus_ascii.h
	avr-gcc -o $@ -mmcu=atmega324p -Os -c src/sys.c

build/app.o: src/app.c src/global.h src/app.h
	avr-gcc -o $@ -mmcu=atmega324p -Os -c src/app.c

build/modbus.o: src/modbus.c src/modbus.h src/modbus_ascii.h
	avr-gcc -o $@ -mmcu=atmega324p -Os -c src/modbus.c

build/modbus_ascii.o: src/modbus_ascii.c src/modbus_ascii.h
	avr-gcc -o $@ -mmcu=atmega324p -Os -c src/modbus_ascii.c

rsync: all
	rsync -aP dist/ pi-hwc:/home/pi/atmega324p_u1/hwc_u1/dist
	
clean:
	-@rm -r dist
	-@rm -r build
