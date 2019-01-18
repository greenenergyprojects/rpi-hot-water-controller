
#include <string.h>
#include <stdint.h>

#include "global.h"
#include "modbus.h"
#include "modbus_ascii.h"
#include "app.h"
#include "sys.h"

struct Modbus modbus;

void modbus_init() {
    memset((void *)&modbus, 0, sizeof(modbus));
    modbus.version = 1;
    modbus.debugLevel = GLOBAL_DEBUG_LEVEL_NONE;
}

void modbus_main () {
}

uint8_t modbus_readInputRegister (uint16_t addr, uint16_t value) {
    return 1;
}


uint8_t modbus_readHoldRegister (uint16_t addr, uint16_t *value) {
    static uint32_t sensor0Cnt = 0;

    if (addr >= 1024) {
        uint16_t *p = NULL;
        uint16_t length = 0, lengthErr = 0;
        switch ((addr >> 8) & 0xfc) {
            case 0x04: p = (uint16_t *)&app; length = sizeof(app); lengthErr = sizeof(app.err); addr -= 0x0400; break;
            case 0x08: p = (uint16_t *)&sys; length = sizeof(sys); lengthErr = sizeof(sys.err); addr -= 0x0800; break;
            case 0x0c: p = (uint16_t *)&modbus; length = sizeof(modbus); lengthErr = sizeof(modbus.err); addr -= 0x0c00; break;
            case 0x10: p = (uint16_t *)&modbus_ascii; length = sizeof(modbus_ascii); lengthErr = sizeof(modbus_ascii.err); addr -= 0x1000; break;
        }
        if (length > 0) {
            if (addr == 0) {
                *value = length;
            } else if (addr == 1) {
                *value = lengthErr;
            } else if (addr < length) {
                *value  = p[addr - 2];
            } else {
                return 1;
            }
        }
        return 0;
    }

    switch (addr) {
        case 0: *value = app_getSetpoint4To20mA(); break;
        case 1: *value = app_getCurr4To20mA(); break;
        case 2: *value = app.sensor0Time; break;
        case 3: {
            sys_cli();
            sensor0Cnt = app.sensor0Cnt;
            sys_sei();
            *value = sensor0Cnt >> 16;
            break;
        }
        case 4: *value = sensor0Cnt & 0xffff; break;
        default: return 1;
    }
    return 0;
}

uint8_t modbus_writeHoldRegister (uint16_t addr, uint16_t value) {
    if (addr >= 1024) {
        uint16_t *p = NULL;
        uint16_t size = 0, lengthErr = 0;;
        switch ((addr >> 8) & 0xfc) {
            case 0x04: p = (uint16_t *)&app; size = sizeof(app); lengthErr = sizeof(app.err); addr -= 0x0400; break;
            case 0x08: p = (uint16_t *)&sys; size = sizeof(sys); lengthErr = sizeof(sys.err); addr -= 0x0800; break;
            case 0x0c: p = (uint16_t *)&modbus; size = sizeof(modbus); lengthErr = sizeof(modbus.err); addr -= 0x0c00; break;
            case 0x10: p = (uint16_t *)&modbus_ascii; size = sizeof(modbus_ascii); lengthErr = sizeof(modbus_ascii.err); addr -= 0x1000; break;
        }
        if (size > 0) {
            if (addr < 2) {
                return 1;
            } else if (addr == 2) {
                ((uint8_t *)p)[1] = value & 0xff;
                if (value >> 8) { // reset error counter
                    for (uint8_t i = 0; i < lengthErr; i++) {
                        ((uint8_t *)p)[2 + i] = 0;
                    }
                }
            }
        }
        return 1;
    }
    switch (addr) {
        case 0: return app_setSetpoint4To20mA(value);
    }

}

