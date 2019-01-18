#ifndef MODBUS_ASCII_H_
#define MODBUS_ASCII_H_

#include <stdint.h>
#include "global.h"

struct ModbusAsciiErrorCnt { // size word aligned !
    uint16_t invalidUartByte;
    uint8_t invalidFrame;
    uint8_t frameOverflow;
    uint8_t lrcError;
    uint8_t byteWhileBusy;
    
};

struct ModbusAscii {
    uint8_t version;
    uint8_t debugLevel;
    struct ModbusAsciiErrorCnt err;
    uint8_t buffer[GLOBAL_MODBUS_ASCII_BUFSIZE];
    uint8_t bIndex;
    uint16_t frameCnt;
};

extern struct ModbusAscii modbus_ascii;

void modbusAscii_init();
void modbusAscii_main ();
void modbusAscii_handleModbusAsciiByte (char c);

#endif // MODBUS_ASCII_H_