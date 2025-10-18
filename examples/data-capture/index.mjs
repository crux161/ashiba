#!/usr/bin/env node
import { discover } from '../../index.js';
import { HAPTIC } from '../../constants.js';

// A simple script to connect to a Loupedeck and dump the raw hex
// for a few common commands, then exit.

let loupedeck;

console.log('Attempting to discover Loupedeck device...');

try {
    // Force connection, don't wait for events in this simple script
    loupedeck = await discover();
} catch (e) {
    console.error(`Device discovery failed: ${e}.`);
    process.exit(1);
}

// --- MODIFICATION FOR LOGGING ---
// We will monkey-patch the 'send' method on the connection object
// to intercept and log all outgoing data. This is cleaner than
// modifying the library files directly.

const originalSend = loupedeck.connection.send;
loupedeck.connection.send = function (buffer, raw = false) {
    // The serial connection sends a 'prep' buffer first. We want to see both.
    if (!raw && this.connection && typeof this.connection.write === 'function') {
        // Re-create the header logic from serial.js to log it
        let prep;
        if (buffer.length > 0xff) {
            prep = Buffer.alloc(14);
            prep[0] = 0x82;
            prep[1] = 0xff;
            prep.writeUInt32BE(buffer.length, 6);
        } else {
            prep = Buffer.alloc(6);
            prep[0] = 0x82;
            prep[1] = 0x80 + buffer.length;
        }
        console.log(`JS SEND -> Header:  ${prep.toString('hex')}`);
    }
    
    // Log the main payload buffer
    console.log(`JS SEND -> Payload: ${buffer.toString('hex')}`);
    
    // Call the original send function to actually send the data
    return originalSend.apply(this, arguments);
};


// --- Main Logic ---

loupedeck.on('connect', async ({ address }) => {
    console.info(`\n✅ Connected to ${loupedeck.type} at ${address}`);

    try {
        console.log('\n--- Sending Commands ---\n');

        // 1. Set Brightness
        console.log("COMMAND: setBrightness(0.5)");
        await loupedeck.setBrightness(0.5); // 50% brightness

        // 2. Set Button Color
        console.log("\nCOMMAND: setButtonColor({ id: 7, color: 'red' })");
        await loupedeck.setButtonColor({ id: 7, color: 'red' });
        
        // 3. Vibrate
        console.log("\nCOMMAND: vibrate(HAPTIC.SHORT)");
        await loupedeck.vibrate(HAPTIC.SHORT);

        console.log('\n--- Finished Sending Commands ---\n');

    } catch (e) {
        console.error('An error occurred while sending commands:', e);
    } finally {
        // Cleanly close the connection and exit
        await loupedeck.close();
        console.log('Connection closed. Exiting.');
        process.exit(0);
    }
});

loupedeck.on('disconnect', (err) => {
    if (err) {
        console.error(`Disconnected with error: ${err.message}`);
    } else {
        console.log('Device disconnected normally.');
    }
});

loupedeck.on('error', (err) => {
    console.error(`A device error occurred: ${err}`);
});

