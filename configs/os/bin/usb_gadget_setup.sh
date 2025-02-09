#!/bin/bash

# USB Gadget Configuration
cd /sys/kernel/config/usb_gadget/kvmd
echo '' >UDC
mkdir -p functions/uac2.usb0

# Disable speaker functionality
echo 0 > functions/uac2.usb0/c_chmask

echo 48000 > functions/uac2.usb0/p_srate        # Playback sample rate (e.g., 48000 Hz)
echo 2 > functions/uac2.usb0/p_chmask           # Playback channel mask (2 channels for stereo)
echo 2 > functions/uac2.usb0/p_ssize           # Playback sample size (e.g., 16 bits)


ln -s functions/uac2.usb0 configs/c.1/
echo /sys/class/udc >UDC