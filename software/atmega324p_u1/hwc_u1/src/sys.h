#ifndef SYS_H_
#define SYS_H_

#include <stdio.h>

#include "global.h"
#if GLOBAL_UART0_RXBUFSIZE > 255
  #error "Error: GLOBAL_UART0_RXBUFSIZE value over maximum (255)"
#endif



typedef unsigned char uint8_t;

// declarations

typedef uint8_t Sys_Event;


struct Sys_Uart0_RXBuffer {
    uint8_t rpos_u8;
    uint8_t wpos_u8;
    uint8_t buffer_u8[GLOBAL_UART0_RXBUFSIZE];
};

struct Sys_Uart0_TXBuffer {
    uint8_t rpos_u8;
    uint8_t wpos_u8;
    uint8_t buffer_u8[GLOBAL_UART0_TXBUFSIZE];
};


struct Sys_Uart0 {
    uint8_t errcnt_u8;
    struct Sys_Uart0_RXBuffer rxbuf;
    struct Sys_Uart0_TXBuffer txbuf;
};

struct Sys_Uart1 {
    uint8_t errcnt_u8;
    uint8_t fillByte;
};

struct Sys_ErrorCnt { // size word aligned !
    uint16_t taskErr_u16;
};

struct Sys {
    uint8_t version;
    uint8_t debugLevel;
    struct Sys_ErrorCnt err;
    uint8_t flags;
    FILE*   fOutModbus;    
    Sys_Event  eventFlag;
    uint8_t adc0_u8;
    struct Sys_Uart0 uart0;
    struct Sys_Uart1 uart1;
};


// declaration and definations

extern struct Sys sys;

// defines

// SYS_FLAG_SREG_I must have same position as I-Bit in Status-Register!!
#define SYS_FLAG_SREG_I          0x80

#define SYS_MODBUS_STATUS_ERR7      7
#define SYS_MODBUS_STATUS_ERR6      6
#define SYS_MODBUS_STATUS_ERR5      5
#define SYS_MODBUS_STATUS_ERR_FRAME 1
#define SYS_MODBUS_STATUS_NEWFRAME  0

// functions

void      sys_init (void);
void      sys_main (void);

void      sys_sei (void);
void      sys_cli (void);

void      sys_inc8BitCnt (uint8_t *count);
void      sys_inc16BitCnt (uint16_t *count);

void      sys_newline (void);

Sys_Event sys_setEvent (Sys_Event event);
Sys_Event sys_clearEvent (Sys_Event event);
Sys_Event sys_isEventPending (Sys_Event event);

uint8_t   sys_uart0_available ();
int16_t   sys_uart0_getBufferByte (uint8_t pos);
void      sys_uart0_flush ();

void      sys_setSSR (uint8_t index, uint8_t on);
void      sys_setSSR1 (uint8_t on);
void      sys_setSSR2 (uint8_t on);
void      sys_setSSR3 (uint8_t on);
void      sys_setSSR4 (uint8_t on);

uint8_t   sys_isSw2On ();
uint8_t   sys_isSensor1On ();
uint8_t   sys_isSensor2On ();

void      sys_setPwm4To20mA (uint8_t value);

void      sys_setLedLife (uint8_t on);
void      sys_setLedPwmGreen (uint8_t on);
void      sys_setLedPT1000Red (uint8_t index, uint8_t on);
void      sys_setLedPT1000Green (uint8_t index, uint8_t on);
void      sys_setLedSensor (uint8_t index, uint8_t on);
void      sys_setLedSensor1 (uint8_t on);
void      sys_setLedSensor2 (uint8_t on);

void      sys_toggleLifeLed ();
void      sys_toggleLedPwmGreen ();

#endif // SYS_H_
