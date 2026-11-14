"""Study sites for MARSAD. bbox = [west, south, east, north] in degrees."""

# NISAR L2 GCOV collections at the Alaska Satellite Facility (NASA CMR concept ids)
COLLECTIONS = ["C3622241360-ASF", "C2854338529-ASF", "C3622214170-ASF"]

SITES = {
    "sindh": {
        "bbox": [67.8, 26.8, 68.4, 27.3],
        "tracks": ["041_A_015"],
        "cell_m": 40,
    },
    "manah": {
        "bbox": [57.62, 22.58, 57.72, 22.64],
        "tracks": ["150_D_077", "128_A_013"],
        "cell_m": 10,
    },
    "po": {
        "bbox": [8.40, 45.20, 8.80, 45.45],
        "tracks": ["144_A_025"],
        "cell_m": 20,
    },
    "salalah": {
        "bbox": [53.95, 16.95, 54.45, 17.35],
        "tracks": ["157_A_010"],
        "cell_m": 30,
    },
    "rondonia": {
        "bbox": [-63.6, -10.6, -63.0, -10.1],
        "tracks": ["161_A_172"],
        "cell_m": 40,
    },
    "jakobshavn": {
        "bbox": [-50.3, 69.0, -49.3, 69.4],
        "tracks": ["170_D_053"],
        "cell_m": 40,
    },
}
