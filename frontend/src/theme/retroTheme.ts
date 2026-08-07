export const RETRO_COLORS = {
  desktop: '#3a6ea5',            // Win95 Teal
  windowBackground: '#d4d0c8',   // Win95 Light Grey
  panelLight: '#ffffff',          // Inner highlight border
  panelDark: '#808080',           // Inner shadow border
  panelDarkest: '#0a0a0a',        // Black border
  titleBarBlue: '#000080',        // Win95 Blue titlebar
  titleBarBlueInactive: '#808080', // Grey inactive titlebar
  titleBarText: '#ffffff',
  titleBarTextInactive: '#c0c0c0',
  text: '#000000',
  textMuted: '#808080',
  surface: '#ffffff',             // White card panel
  primary: '#000080',
  success: '#008000',
  danger: '#800000',
  warning: '#808000',
};

export const RETRO_STYLES = {
  // Raised 3D border (Windows button / raised window look)
  borderRaised: {
    borderWidth: 2,
    borderStyle: 'solid' as const,
    borderTopColor: RETRO_COLORS.panelLight,
    borderLeftColor: RETRO_COLORS.panelLight,
    borderRightColor: RETRO_COLORS.panelDark,
    borderBottomColor: RETRO_COLORS.panelDark,
  },
  // Sunken 3D border (Windows text input / active button look)
  borderSunken: {
    borderWidth: 2,
    borderStyle: 'solid' as const,
    borderTopColor: RETRO_COLORS.panelDark,
    borderLeftColor: RETRO_COLORS.panelDark,
    borderRightColor: RETRO_COLORS.panelLight,
    borderBottomColor: RETRO_COLORS.panelLight,
  },
  // Black border outline (for active elements / focus)
  borderOutline: {
    borderWidth: 1,
    borderColor: RETRO_COLORS.panelDarkest,
  },
};
