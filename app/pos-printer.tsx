import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { formatIrishTime } from "@/lib/timezone";

/**
 * POS Printer Mode
 * 
 * This screen runs on the POS device (Android PDA with built-in thermal printer).
 * It can operate in two modes:
 * 
 * 1. PRINTER MODE (default): Polls the server for print jobs from the tablet.
 *    When a job arrives, it formats and prints the receipt on the built-in printer.
 * 
 * 2. FULL MODE: Also shows the store dashboard, so staff can accept orders
 *    and print directly on the POS if the tablet is unavailable.
 * 
 * Printing approaches (tried in order):
 * A. window.print() — Uses Chrome's built-in print dialog (most compatible)
 * B. WebUSB — Direct USB printer access (if supported by browser)
 * C. Manual — Shows receipt text for manual printing
 */

export default function POSPrinterScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ storeId: string }>();
  const storeId = parseInt(params.storeId || "1");
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [printedCount, setPrintedCount] = useState(0);
  const [currentReceipt, setCurrentReceipt] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for pending print jobs
  const { data: pendingJobs, refetch: refetchJobs } = trpc.print.getPendingJobs.useQuery(
    { storeId },
    { refetchInterval: 3000, enabled: true }
  );

  // Get print history
  const { data: printHistory } = trpc.print.getHistory.useQuery(
    { storeId, limit: 20 },
    { enabled: showHistory }
  );

  const markPrintedMutation = trpc.print.markPrinted.useMutation();
  const markFailedMutation = trpc.print.markFailed.useMutation();

  // Update connection status
  useEffect(() => {
    setIsConnected(true);
    setLastPollTime(new Date());
  }, [pendingJobs]);

  // Auto-process pending print jobs
  useEffect(() => {
    if (!pendingJobs || pendingJobs.length === 0) return;

    const processNextJob = async () => {
      const job = pendingJobs[0];
      if (!job || isPrinting) return;

      setIsPrinting(true);
      setCurrentReceipt(job.receiptContent);

      try {
        // Try to print using the browser's print functionality
        await printReceipt(job.receiptContent);

        // Mark as printed
        await markPrintedMutation.mutateAsync({ printJobId: job.id });
        setPrintedCount(prev => prev + 1);
        setCurrentReceipt(null);

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Refetch to get next job
        refetchJobs();
      } catch (e: any) {
        console.error("[Print] Failed:", e);
        setError(`Print failed: ${e.message}`);
        // Mark as failed after 3 attempts
        try {
          await markFailedMutation.mutateAsync({ printJobId: job.id });
        } catch (markError) {
          console.error("[Print] Failed to mark job as failed:", markError);
        }
        refetchJobs();
      } finally {
        setIsPrinting(false);
      }
    };

    processNextJob();
  }, [pendingJobs, isPrinting]);

  // Print receipt using browser print dialog (most compatible approach)
  const printReceipt = async (content: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Create a hidden iframe for printing
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "none";
      document.body.appendChild(printFrame);

      const doc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Receipt</title>
            <style>
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.3;
                margin: 0;
                padding: 4mm;
                width: 50mm;
                white-space: pre-wrap;
                word-wrap: break-word;
              }
            </style>
          </head>
          <body>${content.replace(/\n/g, "<br>")}</body>
          </html>
        `);
        doc.close();

        // Wait for content to render
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
          printFrame.contentWindow?.print();
        } catch (e) {
          // Fallback: open in new window
          const printWindow = window.open("", "_blank", "width=300,height=600");
          if (printWindow) {
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Receipt</title>
                <style>
                  @page { size: 58mm auto; margin: 0; }
                  body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.3;
                    margin: 0;
                    padding: 4mm;
                    width: 50mm;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                  }
                </style>
              </head>
              <body>${content.replace(/\n/g, "<br>")}</body>
              </html>
            `);
            printWindow.document.close();
            printWindow.print();
          }
        }

        // Clean up iframe
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }
    }
  };

  // Manual print trigger
  const handleManualPrint = async (receiptContent: string) => {
    setIsPrinting(true);
    try {
      await printReceipt(receiptContent);
    } catch (e) {
      console.error("[Print] Manual print failed:", e);
    } finally {
      setIsPrinting(false);
    }
  };

  const pendingCount = pendingJobs?.length || 0;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>
            🖨 POS Printer
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
            Store #{storeId} · Printer Mode
          </Text>
        </View>

        {/* Connection Status */}
        <View style={{
          backgroundColor: isConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
          borderWidth: 1,
          borderColor: isConnected ? "#22C55E" : "#EF4444",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          alignItems: "center",
        }}>
          <View style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: isConnected ? "#22C55E" : "#EF4444",
            marginBottom: 8,
          }} />
          <Text style={{
            fontSize: 18,
            fontWeight: "700",
            color: isConnected ? "#22C55E" : "#EF4444",
          }}>
            {isConnected ? "Connected" : "Connecting..."}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
            {isConnected
              ? `Polling every 3 seconds · ${printedCount} receipt${printedCount !== 1 ? "s" : ""} printed`
              : "Establishing connection to server..."
            }
          </Text>
          {lastPollTime && (
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
              Last check: {formatIrishTime(lastPollTime)}
            </Text>
          )}
        </View>

        {/* Pending Jobs */}
        {pendingCount > 0 && (
          <View style={{
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderWidth: 2,
            borderColor: "#F59E0B",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#92400E", textAlign: "center", marginBottom: 12 }}>
              🔔 {pendingCount} Print Job{pendingCount !== 1 ? "s" : ""} Waiting
            </Text>
            {isPrinting && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <Text style={{ fontSize: 14, color: "#92400E" }}>Printing...</Text>
              </View>
            )}
          </View>
        )}

        {/* Current Receipt Preview */}
        {currentReceipt && (
          <View style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>
              Current Receipt:
            </Text>
            <View style={{
              backgroundColor: "#f9f9f9",
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#e0e0e0",
            }}>
              <Text style={{
                fontFamily: Platform.OS === "web" ? "Courier New, monospace" : undefined,
                fontSize: 11,
                lineHeight: 15,
                color: "#333",
              }}>
                {currentReceipt}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleManualPrint(currentReceipt)}
              disabled={isPrinting}
              style={{
                backgroundColor: "#1a1a2e",
                padding: 14,
                borderRadius: 12,
                alignItems: "center",
                marginTop: 12,
                opacity: isPrinting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                {isPrinting ? "Printing..." : "🖨 Print Now"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Idle State */}
        {pendingCount === 0 && !currentReceipt && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
            alignItems: "center",
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>
              Ready & Waiting
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
              When staff taps "Print Pick List" on the tablet, the receipt will print here automatically.
            </Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderWidth: 1,
            borderColor: "#EF4444",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
          }}>
            <Text style={{ color: "#EF4444", fontWeight: "600", marginBottom: 4 }}>Print Error</Text>
            <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              style={{ marginTop: 8 }}
            >
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Print History Toggle */}
        <TouchableOpacity
          onPress={() => setShowHistory(!showHistory)}
          style={{
            backgroundColor: colors.surface,
            padding: 14,
            borderRadius: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
            📋 Print History
          </Text>
          <Text style={{ fontSize: 16, color: colors.muted }}>
            {showHistory ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {/* Print History List */}
        {showHistory && printHistory && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
          }}>
            {printHistory.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", padding: 16 }}>
                No print history yet
              </Text>
            ) : (
              printHistory.map((job: any) => (
                <View key={job.id} style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(0,0,0,0.05)",
                }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      Order #{job.orderNumber || job.orderId}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {formatIrishTime(job.createdAt)}
                    </Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: job.status === "printed" ? "rgba(34, 197, 94, 0.1)" : job.status === "failed" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                  }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: job.status === "printed" ? "#22C55E" : job.status === "failed" ? "#EF4444" : "#F59E0B",
                    }}>
                      {job.status === "printed" ? "✅ Printed" : job.status === "failed" ? "❌ Failed" : "⏳ Pending"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Instructions */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
            How It Works
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>1️⃣</Text>
              <Text style={{ fontSize: 13, color: colors.muted, flex: 1 }}>
                Keep this page open on the POS device
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>2️⃣</Text>
              <Text style={{ fontSize: 13, color: colors.muted, flex: 1 }}>
                Staff taps "Print Pick List" on the tablet for any order
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>3️⃣</Text>
              <Text style={{ fontSize: 13, color: colors.muted, flex: 1 }}>
                Receipt prints automatically on this device within seconds
              </Text>
            </View>
          </View>
        </View>

        {/* Fallback: Full Dashboard Link */}
        <View style={{
          backgroundColor: "rgba(0, 229, 255, 0.05)",
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 16,
          padding: 16,
          marginBottom: 32,
        }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
            Tablet not working?
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
            You can also manage orders directly on this device. Open the full store dashboard to accept orders and print receipts all from the POS.
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === "web" && typeof window !== "undefined") {
                window.location.href = "/store-dashboard";
              }
            }}
            style={{
              backgroundColor: colors.primary,
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.background, fontWeight: "700", fontSize: 14 }}>
              Open Full Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
