package com.weshop4u.print;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Serial port printer for Android POS terminals with built-in thermal printers.
 * Communicates via serial port using ESC/POS commands.
 */
public class SerialPrinter {

    private static final int BAUD_RATE = 115200;
    private static final int MAX_CHARS_PER_LINE = 32;

    private String serialPort = "/dev/ttyMT1"; // Default port
    private FileOutputStream outputStream;
    private FileInputStream inputStream;
    private String lastError = "";

    private static final byte[] CMD_INIT = {0x1B, 0x40};
    private static final byte[] CMD_BOLD_ON = {0x1B, 0x45, 0x01};
    private static final byte[] CMD_BOLD_OFF = {0x1B, 0x45, 0x00};
    private static final byte[] CMD_CENTER = {0x1B, 0x61, 0x01};
    private static final byte[] CMD_LEFT = {0x1B, 0x61, 0x00};
    private static final byte[] CMD_DOUBLE_SIZE = {0x1B, 0x21, 0x30};
    private static final byte[] CMD_NORMAL = {0x1B, 0x21, 0x00};
    private static final byte[] CMD_FEED_5 = {0x1B, 0x64, 0x05};
    private static final byte[] CMD_CUT = {0x1D, 0x56, 0x42, 0x00};

    public SerialPrinter() {
        this.serialPort = "/dev/ttyMT1";
    }

    public SerialPrinter(String port) {
        this.serialPort = port != null ? port : "/dev/ttyMT1";
    }

    public void setPort(String port) {
        if (port != null && !port.isEmpty()) {
            this.serialPort = port;
        }
    }

    public String getLastError() {
        return lastError;
    }

    public boolean open() {
        try {
            // Try to configure the serial port with stty
            try {
                Process process = Runtime.getRuntime().exec(
                    new String[]{"/system/bin/stty", "-F", serialPort,
                        String.valueOf(BAUD_RATE), "cs8", "-cstopb", "-parenb"}
                );
                int exitCode = process.waitFor();
                if (exitCode != 0) {
                    lastError = "stty configuration failed with exit code " + exitCode;
                }
            } catch (Exception sttyError) {
                lastError = "stty not available: " + sttyError.getMessage();
                // Continue anyway, try direct open
            }

            // Try to open the port
            File serialFile = new File(serialPort);
            if (!serialFile.exists()) {
                lastError = "Serial port file does not exist: " + serialPort;
                return false;
            }

            try {
                outputStream = new FileOutputStream(serialFile);
                inputStream = new FileInputStream(serialFile);
                lastError = "";
                return true;
            } catch (IOException ioError) {
                lastError = "Failed to open port " + serialPort + ": " + ioError.getMessage();
                return false;
            }
        } catch (Exception e) {
            lastError = "Unexpected error opening port: " + e.getMessage();
            e.printStackTrace();
            return false;
        }
    }

    public void close() {
        try {
            if (outputStream != null) {
                try {
                    outputStream.flush();
                } catch (Exception e) {
                    // Ignore flush errors
                }
                try {
                    outputStream.close();
                } catch (Exception e) {
                    // Ignore close errors
                }
                outputStream = null;
            }
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (Exception e) {
                    // Ignore close errors
                }
                inputStream = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public boolean isConnected() { return outputStream != null; }

    private void writeBytes(byte[] data) throws IOException {
        if (outputStream == null) {
            throw new IOException("Serial port not connected. Error: " + lastError);
        }
        try {
            outputStream.write(data);
            outputStream.flush();
        } catch (IOException e) {
            lastError = "Write failed: " + e.getMessage();
            throw e;
        }
    }

    private void writeString(String text) throws IOException {
        writeBytes(text.getBytes("UTF-8"));
    }

    public void init() throws IOException { writeBytes(CMD_INIT); }

    public void printHeader(String text) throws IOException {
        writeBytes(CMD_CENTER); writeBytes(CMD_BOLD_ON); writeBytes(CMD_DOUBLE_SIZE);
        writeString(text + "\n");
        writeBytes(CMD_NORMAL); writeBytes(CMD_BOLD_OFF); writeBytes(CMD_LEFT);
    }

    public void printCentered(String text) throws IOException {
        writeBytes(CMD_CENTER); writeString(text + "\n"); writeBytes(CMD_LEFT);
    }

    public void printCenteredBold(String text) throws IOException {
        writeBytes(CMD_CENTER); writeBytes(CMD_BOLD_ON);
        writeString(text + "\n");
        writeBytes(CMD_BOLD_OFF); writeBytes(CMD_LEFT);
    }

    public void printSeparator() throws IOException {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < MAX_CHARS_PER_LINE; i++) sb.append('-');
        writeString(sb.toString() + "\n");
    }

    public void printLineItem(String name, String price) throws IOException {
        int maxNameLen = MAX_CHARS_PER_LINE - price.length() - 1;
        String displayName = name.length() > maxNameLen ? name.substring(0, maxNameLen) : name;
        int spaces = MAX_CHARS_PER_LINE - displayName.length() - price.length();
        StringBuilder sb = new StringBuilder(displayName);
        for (int i = 0; i < spaces; i++) sb.append(' ');
        sb.append(price);
        writeString(sb.toString() + "\n");
    }

    public void printText(String text) throws IOException { writeString(text + "\n"); }

    public void printBoldText(String text) throws IOException {
        writeBytes(CMD_BOLD_ON); writeString(text + "\n"); writeBytes(CMD_BOLD_OFF);
    }

    public void printEmptyLine() throws IOException { writeString("\n"); }

    public void feedAndCut() throws IOException {
        writeBytes(CMD_FEED_5); writeBytes(CMD_CUT);
    }

    public void printTestReceipt() throws IOException {
        init();
        printHeader("TEST PRINT");
        printSeparator();
        printCenteredBold("Printer OK");
        printEmptyLine();
        printText("Port: " + serialPort);
        printText("Baud: " + BAUD_RATE);
        printText("Width: " + MAX_CHARS_PER_LINE + " chars");
        printSeparator();
        printCentered("Ready to receive orders");
        feedAndCut();
    }
}
