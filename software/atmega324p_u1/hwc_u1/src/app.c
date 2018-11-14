#include "global.h"
#include <stdio.h>
#include <string.h>

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#include "app.h"
#include "sys.h"

// defines

// declarations and definations

struct App app;


// functions

void app_init (void) {
    memset((void *)&app, 0, sizeof(app));
}


//--------------------------------------------------------


// ------------------------------------------------------------------------

void app_main (void) {
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





//--------------------------------------------------------

void app_task_1ms (void) {}
void app_task_2ms (void) {}

void app_task_4ms (void) {
    sys_setLedSensor1(sys_isSensor1On());
    sys_setLedSensor2(sys_isSensor2On());
}

void app_task_8ms (void) {
}


void app_task_16ms (void) {}

void app_task_32ms (void) {
    static uint8_t timer = 0;
    OCR2A = timer++;
}

void app_task_64ms (void) {
    if (!sys_isSw2On()) {
        sys_toggleLifeLed();
    }
}

void app_task_128ms (void) {
    if (sys_isSw2On()) {
        sys_toggleLifeLed();
    }
}

