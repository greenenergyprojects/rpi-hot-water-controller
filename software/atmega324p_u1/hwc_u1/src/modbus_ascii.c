
#include <stdio.h>
#include <string.h>

#include "modbus_ascii.h"
#include "modbus.h"
#include "global.h"
#include "sys.h"

struct ModbusAscii modbus_ascii;
#define ma modbus_ascii

void modbusAscii_handleFrame ();

void modbusAscii_init () {
    memset((void *)&modbus_ascii, 0, sizeof(modbus_ascii));
    ma.version = 1;
    ma.debugLevel = GLOBAL_DEBUG_LEVEL_INFO;
    // ma.debugLevel = GLOBAL_DEBUG_LEVEL_FINE;
}

void modbusAscii_main () {
    uint8_t *p = (uint8_t *)&ma.err;
    uint8_t errDetected = 0;
    for (uint8_t i = 0; i < sizeof(ma.err); i++) {
        if (*p++ != 0) {
            sys_setEvent(GLOBAL_EVENT_MODBUS_ASCII_ERROR);
            errDetected = 1;
            break;
        }
    }
    if (sys_isSw2On() && errDetected) {
        memset((void *)&modbus_ascii.err, 0, sizeof(modbus_ascii.err));
    }
    if (sys_isEventPending(GLOBAL_EVENT_MODBUS_BUSY)) {
        modbusAscii_handleFrame();
        ma.bIndex = 0;
        sys_clearEvent(GLOBAL_EVENT_MODBUS_BUSY);

    }
}


int8_t modbusAscii_hex2nibble(uint8_t hex) {
    if (hex >= '0' && hex <= '9') {
        return hex - '0';
    } else if (hex >= 'A' && hex <= 'F') {
        return hex - 'A' + 10;
    } else {
        return -1;
    }
}

int8_t modbusAscii_hexBuffer2BinBuffer(uint8_t from[], uint8_t to[], int16_t size) {
    int8_t rv = 0;
    while (size > 0) {
        int8_t high = modbusAscii_hex2nibble(*from++);
        int8_t low = modbusAscii_hex2nibble(*from++);
        if (high < 0 || low < 0) {
            return -1;
        }
        *to++ = (high << 4) | low;
        rv++;
        size -= 2;
    }
    return rv;
}

void modbusAscii_sendResponse (uint8_t length) {
    uint8_t lrc = 0;
    fputc(':', sys.fOutModbus);
    uint8_t *p = &ma.buffer[0];
    uint8_t size = length;
    while (size-- > 0) {
        lrc += *p;
        fprintf(sys.fOutModbus, "%02X", *p++);
    }

    fprintf(sys.fOutModbus, "%02X\r\n", (uint8_t)( -((signed char)lrc)));
    if (ma.debugLevel >= GLOBAL_DEBUG_LEVEL_FINE) {
        printf("Response :");
        for (uint8_t i = 0; i < length; i++) { printf("%02X", ma.buffer[i]); }
         printf("%02X", lrc);
        printf("\\r\\n\r\n");
    }

}

void modbusAscii_sendErrorResponse (uint8_t exceptionCode) {
    ma.buffer[1] |= 0x80;
    ma.buffer[2] |= exceptionCode;
    return modbusAscii_sendResponse(3);
}


void modbusAscii_handleFrame () {
    sys_setEvent(GLOBAL_EVENT_MODBUS_ASCII_FRAME);
    int8_t size = modbusAscii_hexBuffer2BinBuffer(&ma.buffer[1], &ma.buffer[0], ma.bIndex - 1);
    if (ma.debugLevel >= GLOBAL_DEBUG_LEVEL_FINE) {
        printf("Request (%02x) :", size);
        for (uint8_t i = 0; i < size; i++) { printf("%02X", ma.buffer[i]); }
        printf("\\r\\n\r\n");
    }

    uint8_t lrc = 0 ;
    for (uint8_t i = 0; i < size - 1; i++) {
        lrc += ma.buffer[i];
    }
    lrc = (uint8_t) ( -((signed char)lrc) );

    if (lrc == ma.buffer[size - 1]) {
        if (ma.buffer[0] == GLOBAL_MODBUS_DEVICEADDR) {
            uint16_t w1 = ma.buffer[2] << 8 | ma.buffer[3];
            uint16_t w2 = ma.buffer[4] << 8 | ma.buffer[5];
            switch (ma.buffer[1]) {
                case 0x03: {
                    if (w2 < 1 || w2 > 0x7d || w2 > (GLOBAL_MODBUS_ASCII_BUFSIZE - 2)) {
                        return modbusAscii_sendErrorResponse(0x03);
                    } else {
                        uint16_t addr = w1;
                        uint8_t size = w2;
                        uint16_t i = 2;
                        ma.buffer[i++] = size * 2;
                        while (size-- > 0) {
                            uint16_t value;
                            if (modbus_readHoldRegister(addr++, &value)) {
                                return modbusAscii_sendErrorResponse(0x03);
                            }
                            ma.buffer[i++] = value >> 8;
                            ma.buffer[i++] = value & 0xff;
                        }                        
                        return modbusAscii_sendResponse(i);
                    }
                    break;
                }

                case 0x06: {
                    uint16_t addr = w1;
                    uint16_t value = w2;
                    if (modbus_writeHoldRegister(addr, value)) {
                        return modbusAscii_sendErrorResponse(0x02);
                    }
                    return modbusAscii_sendResponse(6);
                }

                default: {
                    return modbusAscii_sendErrorResponse(0x01);
                    
                }
            }
        }

    } else {
        sys_inc8BitCnt(&ma.err.lrcError);
        if (ma.debugLevel >= GLOBAL_DEBUG_LEVEL_WARN) {
            printf("LRC %02X Error (expect %02X)\r\n", ma.buffer[size - 1], lrc);
        }
    }
}

void modbusAscii_handleModbusAsciiByte (char c) {
    static uint8_t isLastByteCR = 0;
    
    if (sys_isEventPending(GLOBAL_EVENT_MODBUS_BUSY)) {
        sys_inc8BitCnt(&ma.err.byteWhileBusy);
        return;
    }

    if (ma.bIndex == 0 && c != ':') {
        if (ma.frameCnt > 0) {
            sys_inc16BitCnt(&ma.err.invalidUartByte);
        }

    } else if (c == ':') {
        if (ma.bIndex > 0) {
            sys_inc8BitCnt(&ma.err.invalidFrame);
            ma.bIndex = 0;
        }
        isLastByteCR = 0;

    } else if (c == '\n') {
        if (isLastByteCR && ma.bIndex % 2 == 1) {
            sys_setEvent(GLOBAL_EVENT_MODBUS_BUSY);
        } else {
            sys_inc8BitCnt(&ma.err.invalidFrame);
            ma.bIndex = 0;
        }
        isLastByteCR = 0;
        return;

    } else if (c == '\r') {
        isLastByteCR = 1;
        return;

    } else if (!(c >= '0' || c <= '1') && !(c >= 'A' && c <= 'F')) {
        sys_inc16BitCnt(&ma.err.invalidUartByte);
        ma.bIndex = 0;
        return;
    }

    if (ma.bIndex >= sizeof ma.buffer) {
        sys_inc8BitCnt(&ma.err.frameOverflow);
        return;
    }

    ma.buffer[ma.bIndex++] = c;
}