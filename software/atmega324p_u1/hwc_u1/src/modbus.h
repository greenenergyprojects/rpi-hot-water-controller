#ifndef MODBUS_H_
#define MODBUS_H_

struct Modbus_ErrorCnt { // size word aligned !
    uint16_t error_u16;
};

struct Modbus {
    uint8_t version;
    uint8_t debugLevel;
    struct Modbus_ErrorCnt err;
};

extern struct Modbus modbus;


void modbus_init();
void modbus_main ();

uint8_t modbus_readInputRegister (uint16_t addr, uint16_t value);
uint8_t modbus_readHoldRegister (uint16_t addr, uint16_t *value);
uint8_t modbus_writeHoldRegister (uint16_t addr, uint16_t value);

#endif // MODBUS_H_