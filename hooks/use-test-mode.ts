import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook to manage test mode state
 * Provides access to test mode status and toggle functionality.
 * Toggling requires the admin PIN — checked server-side.
 */
export function useTestMode() {
  const [testingModeEnabled, setTestingModeEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState("");

  // Fetch test mode status
  const { data: testModeData, isLoading } = trpc.admin.getTestingMode.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update local state when data changes
  useEffect(() => {
    if (testModeData?.enabled !== undefined) {
      setTestingModeEnabled(testModeData.enabled);
    }
  }, [testModeData?.enabled]);

  // Toggle mutation
  const toggleMutation = trpc.admin.toggleTestingMode.useMutation({
    onSuccess: (result) => {
      setTestingModeEnabled(result.enabled);
      setToggleError("");
    },
    onError: (error) => {
      console.error("Failed to toggle test mode:", error);
      setToggleError(error.message);
    },
  });

  // Toggle test mode
  const toggleTestingMode = async (enabled: boolean, pin: string) => {
    setIsToggling(true);
    try {
      await toggleMutation.mutateAsync({ enabled, pin });
    } catch {
      // error is surfaced through toggleError
    } finally {
      setIsToggling(false);
    }
  };

  return {
    testingModeEnabled,
    isLoading,
    toggleTestingMode,
    isToggling: isToggling || toggleMutation.isPending,
    toggleError,
    clearToggleError: () => setToggleError(""),
  };
}
