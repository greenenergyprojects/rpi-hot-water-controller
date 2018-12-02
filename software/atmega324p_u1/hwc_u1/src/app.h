#ifndef APP_H_
#define APP_H_

// declarations


struct App_ErrCounter { // size word aligned !
    uint8_t modbus_ascii_lrc;
    uint8_t modbus_ascii_crlf;
};

struct App {
    uint8_t version;
    uint8_t debugLevel;
    struct App_ErrCounter err;
    uint8_t setpoint4To20mA;
    uint8_t curr4To20mAx8;
    uint8_t pwmLedTimer;
};

extern struct App app;


// defines

// functions

void app_init ();
void app_main ();

uint8_t  app_setSetpoint4To20mA (uint8_t value);
uint8_t  app_getSetpoint4To20mA ();
uint16_t app_getAdc4To20mA ();


void app_task_1ms   ();
void app_task_2ms   ();
void app_task_4ms   ();
void app_task_8ms   ();
void app_task_16ms  ();
void app_task_32ms  ();
void app_task_64ms  ();
void app_task_128ms ();

#endif  // APP_H_
