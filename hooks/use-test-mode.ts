import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook to manage test mode state
 * Provides access to test mode status and toggle functionality
 */
export function useTestMode() {
  const [testingModeEnabled, setTestingModeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Fetch test mode status on mount
  useEffect(() => {
    const fetchTestMode = async () => {
      try {
        setIsLoading(true);
        const result = await trpc.admin.getTestingMode.useQuery().data;
        if (result) {
          setTestingModeEnabled(result.enabled);
        }
      } catch (error) {
        console.error("Failed to fetch test mode status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTestMode();
  }, []);

  // Toggle test mode
  const toggleTestingMode = async (enabled: boolean) => {
    try {
      setIsToggling(true);
      await trpc.admin.toggleTestingMode.useMutation().mutate({ enabled });
      setTestingModeEnabled(enabled);
    } catch (error) {
      console.error("Failed to toggle test mode:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return {
    testingModeEnabled,
    isLoading,
    toggleTestingMode,
    isToggling,
  };
}
