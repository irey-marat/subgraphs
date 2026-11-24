// src/data/global-layout.js

export const GLOBAL_LAYOUT = {
  size: [7, 7],
  cellPx: 98,
  sectors: {
    1001: { gx: 3, gy: 0, name: 'West Cape' },
    1002: { gx: 4, gy: 0, name: 'North Beach' },
    1003: { gx: 5, gy: 0, name: 'Abbey road' },
    1004: { gx: 6, gy: 0, name: 'Threeforce' },
    1005: { gx: 2, gy: 1, name: 'Sector SA98' },
    1006: { gx: 3, gy: 1, name: 'Raged Land' },
    1007: { gx: 4, gy: 1, name: 'Alpha Three' },
    1008: { gx: 5, gy: 1, name: 'Army Base' },
    1009: { gx: 6, gy: 1, name: 'Overlord Point' },
    1010: { gx: 2, gy: 2, name: 'Ejection Point' },
    1011: { gx: 3, gy: 2, name: 'Spherix point' },
    1012: { gx: 4, gy: 2, name: 'Aikon' },
    1013: { gx: 5, gy: 2, name: 'South Normand' },
    1014: { gx: 6, gy: 2, name: 'East Cape' },
    1015: { gx: 1, gy: 3, name: 'Nou Lake' },
    1016: { gx: 2, gy: 3, name: 'Dangerous Xith' },
    1017: { gx: 3, gy: 3, name: 'Eye of Glory' },
    1018: { gx: 4, gy: 3, name: 'Thordendal' },
    1019: { gx: 5, gy: 3, name: 'Por Eso One' },
    1020: { gx: 1, gy: 4, name: 'Shoretale' },
    1021: { gx: 2, gy: 4, name: 'Second Path' },
    1022: { gx: 3, gy: 4, name: 'Chelby' },
    1023: { gx: 4, gy: 4, name: 'Tracid Line' },
    1024: { gx: 5, gy: 4, name: 'Freestates' },
    1025: { gx: 3, gy: 5, name: 'Tiger Lairs' },
    1026: { gx: 4, gy: 5, name: 'Hypercube' },
    1027: { gx: 5, gy: 5, name: "World's Corner" },
    1028: { gx: 3, gy: 6, name: 'South Tibet' }
  }
};

export function getSectorGlobalPos(sectorId) {
  return GLOBAL_LAYOUT.sectors[sectorId] || null;
}

export function getSectorName(sectorId) {
  const s = GLOBAL_LAYOUT.sectors[sectorId];
  return s ? s.name : String(sectorId);
}