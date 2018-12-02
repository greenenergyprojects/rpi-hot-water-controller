#include "global.h"
#include <stdio.h>
#include <string.h>

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#include "app.h"
#include "sys.h"

// defines
#define test 0

// declarations and definations

struct App app;


// functions

void app_init (void) {
    memset((void *)&app, 0, sizeof(app));
    app.version = 1;
}


//--------------------------------------------------------


// ------------------------------------------------------------------------

void app_test () {
    if (sys_isSw2On()) {
        sys_setLedPwmGreen(1);
        sys_setSSR(2, 1);
        sys_setSSR(3, 1);
        OCR2A = 0xff;
        sys_setLedPT1000Green(0, 1);
        sys_setLedPT1000Green(1, 1);
        sys_setLedPT1000Red(0, 0);
        sys_setLedPT1000Red(1, 0);
        // sys_setLedSensor1(1);
        // sys_setLedSensor2(0);

    } else {
        sys_setLedPwmGreen(0);
        sys_setSSR(2, 0);
        sys_setSSR(3, 0);
        sys_setLedPT1000Green(0, 0);
        sys_setLedPT1000Green(1, 0);
        sys_setLedPT1000Red(0, 1);
        sys_setLedPT1000Red(1, 1);
        // sys_setLedSensor1(0);
        // sys_setLedSensor2(1);

    }
}

void app_main (void) {
    if (test) {
        app_test();
    }
    app.curr4To20mAx8 = 1 + (233 * sys.adc0_u8) / 256;
    if (app.curr4To20mAx8 < (4 * 8)) {
        app.pwmLedTimer = 0;
    } else {
        app.pwmLedTimer = 8000 / app.curr4To20mAx8;
    }
    // if (app.setpoint4To20mA > 0) {
    //     sys_setLedPwmGreen(1);
    // } else {
    //     sys_setLedPwmGreen(0);
    // }
}

uint8_t app_getSetpoint4To20mA () {
    return app.setpoint4To20mA;
}

uint8_t app_setSetpoint4To20mA (uint8_t value) {
    app.setpoint4To20mA = value;
    sys_setPwm4To20mA(value);
    return 0;
}

uint16_t app_getAdc4To20mA () {
    printf("ADC0=%3d\r\n", sys.adc0_u8);
    return sys.adc0_u8;
}




//--------------------------------------------------------

void app_task_1ms (void) {
    static uint16_t timer = 0;
    if (timer <= 200) {
        timer = 1000;
    } else {
        timer--;
    }
    if (app.curr4To20mAx8 < (4 * 8)) {
        sys_setLedPwmGreen(0);
    } else if (app.curr4To20mAx8 > (20 * 8)) {
        sys_setLedPwmGreen(1);
    } else if (timer < (app.curr4To20mAx8 * 25) / 4) {
        sys_setLedPwmGreen(1);
    } else {
        sys_setLedPwmGreen(0);
    }
}

void app_task_2ms (void) {}

void app_task_4ms (void) {
    if (test) {
        sys_setLedSensor1(sys_isSensor1On());
        sys_setLedSensor2(sys_isSensor2On());
    }
}

void app_task_8ms (void) {
}


void app_task_16ms (void) {}

void app_task_32ms (void) {
    if (test) {
        static uint8_t timer = 0;
        OCR2A = timer++;
    }
}

void app_task_64ms (void) {
    if (sys_isSw2On()) {
        sys_toggleLifeLed();
    }
}

void app_task_128ms (void) {
    if (!sys_isSw2On()) {
        sys_toggleLifeLed();
    }
    if (sys_clearEvent(GLOBAL_EVENT_MODBUS_ASCII_FRAME)) {
        sys_setLedSensor1(1);
    } else {
        sys_setLedSensor1(0);
    }
    if (sys_clearEvent(GLOBAL_EVENT_MODBUS_ASCII_ERROR)) {
        sys_setLedPT1000Red(0, 1);
    } else {
        sys_setLedPT1000Red(0, 0);
    }
}

