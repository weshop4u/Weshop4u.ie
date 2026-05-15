# NativeWind vars() Key Finding

From the official docs: "Variables set via vars() follow standard CSS variable inheritance -- child components can reference variables set by any ancestor. Variables are reactive and update children when values change."

This means:
1. The View wrapper with vars() IS required on native for CSS variables to flow down
2. If we remove the View wrapper, all className color tokens (bg-background, text-foreground, etc.) will NOT resolve on native
3. The "reactive" part is the problem - when vars values change, ALL children re-render

SOLUTION: Keep the View wrapper with vars(), but make the vars object TRULY stable by:
- Computing it at MODULE LEVEL (outside the component)
- Passing a stable reference that never changes
- This way the View style never changes, so no re-renders cascade down
