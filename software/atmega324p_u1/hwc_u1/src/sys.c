#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>
#include "./global.h"
#include <util/delay.h>

#include "./sys.h"
#include "./modbus_ascii.h"
#include "./app.h"

// defines


#define SYS_UART0_BYTE_RECEIVED (UCSR0A & (1 << RXC0))
#define SYS_UART0_UDR_IS_EMPTY (UCSR0A & (1 << UDRE0))
#define SYS_UDR0 UDR0

#define SYS_UART1_BYTE_RECEIVED (UCSR1A & (1 << RXC1))
#define SYS_UART1_UDR_IS_EMPTY (UCSR1A & (1 << UDRE1))
#define SYS_UDR1 UDR1
// #define SYS_UART_RECEIVE_VECTOR USART0_RX_vect
// #define SYS_TIMER0_VECTOR TIMER0_COMPA_vect

// declarations and definations

struct Sys sys;

// functions

int sys_uart0_putch (char c, FILE *f);
int sys_uart1_putch (char c, FILE *f);
int sys_uart0_getch (FILE *f);

static FILE sys_stdin = FDEV_SETUP_STREAM(NULL, sys_uart0_getch, _FDEV_SETUP_READ);
static FILE sys_stdout = FDEV_SETUP_STREAM(sys_uart0_putch, NULL, _FDEV_SETUP_WRITE);
static FILE sys_fOutModbus = FDEV_SETUP_STREAM(sys_uart1_putch, NULL, _FDEV_SETUP_WRITE);


void sys_init () {
    memset((void *)&sys, 0, sizeof(sys));
    sys.version = 1;
    _delay_ms(1);

    // DDRA |= 0x07;  // Debug
    // PORTA = 0;

    DDRA |= 0x08;          // LEDs: PT1000-2-g
    DDRB |= 0x0c;          // LEDs: SEN-1, SEN-2
    DDRB &= ~(1 << PB0);   // Sensor 2
    DDRB &= ~(1 << PB1);   // Sensor 1 / S0 Energymeter
    DDRB &= ~(1 << PB4);   // Switch SW2
    PORTB |= (1 << PB4);
    DDRC |= 0xc0;          // LEDs: PT1000-2-r, Life
    DDRC |= 0x3c;          // SSR4, SSR3, SSR2, SSR1
    DDRD |= 0x70;          // LEDs: PT1000-1-g, PT1000-1-r, LED Pwm-Green

    TCCR2A = (1 << COM2A1) | (1 << COM2A0) | (1 << WGM21) | (1 << WGM20);
    TCCR2B = (1 << CS20);
    OCR2A = 0xff;
    DDRD |= (1 << PD7);    // PWM

    // PORTD |= (1 << PD7);
    // PORTD &= ~(1 << PD6);
    // DDRD |= 0xc0;  // PD7=nModbus1_RE, PD6=Modbus1_DE

    // Timer 0 for task machine
    OCR0A  = (F_CPU + 4) / 8 / 10000 - 1;
    TCCR0A = (1 << WGM01);
    TCCR0B = (1 << CS01);
    TIMSK0 = (1 << OCIE0A);
    TIFR0  = (1 << OCF0A);

    // Timer 1 for Modbus-RTU timing measurments
    // TCCR1A = 0;
    // TCCR1B = (1 << CS11);  // f=12MHz
    // OCR1A  = 0xffff;
    // TIMSK1 = (1 << OCIE1A);

    // ADC
    ADMUX = (1 << REFS1) | (0 << REFS0) | (1 << ADLAR) | 0;
    ADCSRA = (1 << ADEN) | 0x07;

    // UART0 (Mini USB)
    UBRR0L = (F_CPU/GLOBAL_UART0_BITRATE + 4)/8 - 1;
    UBRR0H = 0x00;
    UCSR0A = (1 << U2X0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
    UCSR0B = (1 << RXCIE0) | (1 << TXEN0) | (1 << RXEN0);

    // UART1 (Modbus/RPI)
    UBRR1L = (F_CPU/GLOBAL_UART1_BITRATE + 4)/8 - 1;
    UBRR1H = 0x00;
    UCSR1A = (1 << U2X1);
    UCSR1C = (1 << UCSZ11) | (1 << UCSZ10);
    UCSR1B = (1 << RXCIE1) | (1 << TXEN1) | (1 << RXEN1);

    // connect libc functions printf(), gets()... to UART
    // fdevopen(sys_monitor_putch, sys_monitor_getch);
    stdout = &sys_stdout;
    stderr = &sys_stdout;
    stdin  = &sys_stdin;
    sys.fOutModbus = &sys_fOutModbus;
}


void sys_main (void) {
}

//----------------------------------------------------------------------------

void sys_inc8BitCnt (uint8_t *count) {
    if (*count < 0xff) {
        (*count)++;
    }
}


void sys_inc16BitCnt (uint16_t *count) {
    if (*count < 0xffff) {
        (*count)++;
    }
}


void sys_sei (void) {
    if (sys.flags & SYS_FLAG_SREG_I) {
        sei();
    }
}


void sys_cli (void) {
    if (SREG & 0x80) {
        sys.flags |= SYS_FLAG_SREG_I;
    } else {
        sys.flags &= ~SYS_FLAG_SREG_I;
    }
    cli();
}


void sys_newline (void) {
    printf("\n");
}

//----------------------------------------------------------------------------

int sys_uart0_getch (FILE *f) {
    if (f != stdin) {
        return EOF;
    }
    if (sys.uart0.txbuf.wpos_u8 == sys.uart0.txbuf.rpos_u8) {
        return EOF;
    }
    uint8_t c = sys.uart0.txbuf.buffer_u8[sys.uart0.txbuf.rpos_u8++];
    if (sys.uart0.txbuf.rpos_u8 >= GLOBAL_UART0_RXBUFSIZE) {
        sys.uart0.txbuf.rpos_u8 = 0;
    }
    return (int) c;
}


int sys_uart0_putch (char c, FILE *f) {
    if (f != stdout) {
        return EOF;
    }
    while (!SYS_UART0_UDR_IS_EMPTY) {
    }
    SYS_UDR0 = (uint8_t)c;
    return (int)c;
}

int sys_uart1_putch (char c, FILE *f) {
    if (f != &sys_fOutModbus) {
        return EOF;
    }
    while (!SYS_UART1_UDR_IS_EMPTY) {
    }
    SYS_UDR1 = (uint8_t)c;
    return (int)c;
}


uint8_t sys_uart0_available (void) {
    return sys.uart0.txbuf.wpos_u8 >= sys.uart0.txbuf.rpos_u8
             ? sys.uart0.txbuf.wpos_u8 - sys.uart0.txbuf.rpos_u8
             : (uint8_t)( ((int16_t)sys.uart0.txbuf.wpos_u8) + GLOBAL_UART0_RXBUFSIZE - sys.uart0.txbuf.rpos_u8);
}


//----------------------------------------------------------------------------

int16_t sys_uart0_getBufferByte (uint8_t pos) {
    int16_t value;
    sys_cli();

    if (pos >= sys_uart0_available()) {
        value = -1;
    } else {
        uint8_t bufpos = sys.uart0.txbuf.rpos_u8 + pos;
        if (bufpos >= GLOBAL_UART0_RXBUFSIZE)
            bufpos -= GLOBAL_UART0_RXBUFSIZE;
        value = sys.uart0.txbuf.buffer_u8[bufpos];
    }

    sys_sei();
    return value;
}


void sys_uart0_flush (void) {
    sys_cli();
    while (SYS_UART0_BYTE_RECEIVED)
        sys.uart0.txbuf.buffer_u8[0] = SYS_UDR0;

    sys.uart0.txbuf.rpos_u8 = 0;
    sys.uart0.txbuf.wpos_u8 = 0;
    sys.uart0.errcnt_u8 = 0;
    sys_sei();
}


//****************************************************************************
// Event Handling
//****************************************************************************

Sys_Event sys_setEvent (Sys_Event event) {
    sys_cli();
    uint8_t eventIsPending = ((sys.eventFlag & event) != 0);
    sys.eventFlag |= event;
    sys_sei();
    return eventIsPending;
}


Sys_Event sys_clearEvent (Sys_Event event) {
    sys_cli();
    uint8_t eventIsPending = ((sys.eventFlag & event) != 0);
    sys.eventFlag &= ~event;
    sys_sei();
    return eventIsPending;
}


Sys_Event sys_isEventPending (Sys_Event event) {
    return (sys.eventFlag & event) != 0;
}

//****************************************************************************
// SSR Handling
//****************************************************************************

void sys_setSSR (uint8_t index, uint8_t on) {
    if (on) {
        switch (index) {
            case 0: PORTC |= (1 << PC2); return;
            case 1: PORTC |= (1 << PC3); return;
            case 2: PORTC |= (1 << PC4); return;
            case 3: PORTC |= (1 << PC5); return;
        }
    } else {
        switch (index) {
            case 0: PORTC &= ~(1 << PC2); return;
            case 1: PORTC &= ~(1 << PC3); return;
            case 2: PORTC &= ~(1 << PC4); return;
            case 3: PORTC &= ~(1 << PC5); return;
        }
    }
}

void sys_setSSR1 (uint8_t on) {
    sys_setSSR(0, on);
}

void sys_setSSR2 (uint8_t on) {
    sys_setSSR(1, on);
}

void sys_setSSR3 (uint8_t on) {
    sys_setSSR(2, on);
}

void sys_setSSR4 (uint8_t on) {
    sys_setSSR(3, on);
}

//****************************************************************************
// Switch Handling
//****************************************************************************

uint8_t sys_isSw2On () {
    return (PINB & (1 << PB4)) != 0;
}

uint8_t sys_isSensor1On () {
    return (PINB & (1 << PB1)) != 0;
}

uint8_t sys_isSensor2On () {
    return (PINB & (1 << PB0)) != 0;
}


//****************************************************************************
// 4 to 20mA handling
//****************************************************************************

void sys_setPwm4To20mA (uint8_t value) {
    OCR2A = 0xff - value;
}

//****************************************************************************
// LED Handling
//****************************************************************************

void sys_setLedLife (uint8_t on) {
    if (on) {
        PORTC |= (1 << PC6);
    } else {
        PORTC &= ~(1 << PC6);
    }
}

void sys_setLedPT1000Red (uint8_t index, uint8_t on) {
    if (on) {
        switch (index) {
            case 0: PORTD |= (1 << PD5); return;
            case 1: PORTC |= (1 << PC7); return;
        }
        
    } else {
        switch (index) {
            case 0: PORTD &= ~(1 << PD5); return;
            case 1: PORTC &= ~(1 << PC7); return;
        }
    }
}

void sys_setLedPT1000Green (uint8_t index, uint8_t on) {
    if (on) {
        switch (index) {
            case 0: PORTD |= (1 << PD6); return;
            case 1: PORTA |= (1 << PA3); return;
        }
        
    } else {
        switch (index) {
            case 0: PORTD &= ~(1 << PD6); return;
            case 1: PORTA &= ~(1 << PA3); return;
        }
    }
}

void sys_setLedSensor (uint8_t index, uint8_t on) {
    if (on) {
        switch (index) {
            case 0: PORTB |= (1 << PB3); return;
            case 1: PORTB |= (1 << PB2); return;
        }
        
    } else {
        switch (index) {
            case 0: PORTB &= ~(1 << PB3); return;
            case 1: PORTB &= ~(1 << PB2); return;
        }
    }
}

void sys_setLedSensor1 (uint8_t on) {
    sys_setLedSensor(0, on);
}

void sys_setLedSensor2 (uint8_t on) {
    sys_setLedSensor(1, on);
}

void sys_setLedPwmGreen (uint8_t on) {
    if (on) {
        PORTD |= (1 << PD4);
    } else {
        PORTD &= ~(1 << PD4);
    }
}


void sys_toggleLifeLed () {
    PORTC ^= (1 << PC6);
}

void sys_toggleLedPwmGreen () {
    PORTD ^= (1 << PD4);
}


// ------------------------------------
// Interrupt Service Routinen
// ------------------------------------

ISR (USART0_RX_vect) {
    static uint8_t lastChar;
    uint8_t c = UDR0;

    if (c == 'R' && lastChar == '@') {
        wdt_enable(WDTO_15MS);
        wdt_reset();
        while (1) {}
    }
    lastChar = c;

    // app_handleUart0Byte(c);
}

ISR (USART1_RX_vect) {
    uint8_t b = UDR1;
    #if GLOBAL_MODBUS_ECHOREQUEST != 0
        UDR1 = b;
    #endif
    #if GLOBAL_MODBUS_DEBUGLEVEL > 5
        printf(" %02x", b);
    #endif
    modbusAscii_handleModbusAsciiByte((char)b);
}

// Timer 0 Output/Compare Interrupt
// called every 100us
ISR (TIMER0_COMPA_vect) {
    static uint8_t cnt100us = 0;
    cnt100us++;
    if (cnt100us >= 5) {
        static uint8_t cnt500us = 0;
        static uint8_t busy = 0;
        cnt100us = 0;
        cnt500us++;
        if (busy) {
            sys_inc16BitCnt(&sys.err.taskErr_u16);
        } else {
            busy = 1;
            sei();
            if      (cnt500us & 0x01) app_task_1ms();
            else if (cnt500us & 0x02) {
                app_task_2ms();
                sys.adc0_u8 = ADCH;
                ADCSRA |= (1 << ADSC);
            
            } 
            else if (cnt500us & 0x04) app_task_4ms();
            else if (cnt500us & 0x08) app_task_8ms();
            else if (cnt500us & 0x10) app_task_16ms();
            else if (cnt500us & 0x20) app_task_32ms();
            else if (cnt500us & 0x40) app_task_64ms();
            else if (cnt500us & 0x80) app_task_128ms();
            busy = 0;
        }
    }
}

ISR (TIMER1_COMPA_vect) {
    TCCR1B = 0;  // disable timer 1
    // app_handleUart1Timeout();
}

