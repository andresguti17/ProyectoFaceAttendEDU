/**
 * Posiciones predefinidas para badges flotantes
 */

// Posiciones desktop (contenedor ~400x400)
export const BadgePositions = {
  topLeft: { position: "absolute", top: "33.5%", left: "-12.5%" },
  topRight: { position: "absolute", top: "15%", right: "5%" },
  bottom: { position: "absolute", bottom: "15%", right: "5%" },
};

// Posiciones mobile (contenedor ~260x260)
export const BadgePositionsMobile = {
  topRight: { position: "absolute", top: "17%", right: "-8%" },
  topLeft: { position: "absolute", top: "49%", left: "-28%" },
  bottom: { position: "absolute", bottom: "-2%", right: "0%" },
};

export default BadgePositions;
