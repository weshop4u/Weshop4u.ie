# NativeWind Remount Issue

From GitHub issue #873: "Making a component inheritable should only happen during the initial render otherwise it will remount the component."

This confirms that NativeWind v4 CAN cause component remounts on native when:
1. CSS variables change (which triggers style recalculation)
2. The component's "inheritable" status changes after initial render
3. The JSX transform wraps components differently between renders

Key insight from Medium article: "Avoid creating components inside render methods" — NativeWind's JSX transform effectively creates new component wrappers when className changes.

SOLUTION IDEAS:
1. Use `cssInterop` to explicitly register TextInput so NativeWind doesn't recreate it
2. Or: wrap TextInput in a stable component that uses style instead of className
3. Or: disable NativeWind's JSX transform for TextInput specifically
