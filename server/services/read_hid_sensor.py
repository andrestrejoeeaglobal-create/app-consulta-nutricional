import sys
import json
import ctypes
from ctypes import c_ulong, create_string_buffer, byref

path = r"\\?\hid#vid_5608&pid_0808#7&61f35d0&1&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}"

GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000
FILE_SHARE_READ = 1
FILE_SHARE_WRITE = 2
OPEN_EXISTING = 3

result = {
    "connected": False,
    "handContact": False,
    "adc": 0,
    "voltage_uv": 0.0,
    "impedance_ohms": 0,
    "raw_packet": []
}

try:
    h = ctypes.windll.kernel32.CreateFileW(
        path, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, None, OPEN_EXISTING, 0, None
    )

    if h != -1 and h != 0:
        buf = create_string_buffer(9)
        bytes_read = c_ulong()
        
        if ctypes.windll.kernel32.ReadFile(h, buf, 9, byref(bytes_read), None):
            raw = list(buf.raw[:bytes_read.value])
            adc_val = raw[2] if len(raw) > 2 else 0
            # ADC to voltage/impedance calibration
            # 8-bit ADC mapping: 0-255 -> 0-100 uV microvoltage
            uv = round((adc_val / 255.0) * 100.0, 2)
            # Impedance mapping: standard hand-to-hand bioimpedance range 500-2500 ohms
            ohms = int(600 + (adc_val / 255.0) * 1500)
            
            result["connected"] = True
            result["handContact"] = True
            result["adc"] = adc_val
            result["voltage_uv"] = uv
            result["impedance_ohms"] = ohms
            result["raw_packet"] = raw

        ctypes.windll.kernel32.CloseHandle(h)
except Exception as e:
    result["error"] = str(e)

print(json.dumps(result))
