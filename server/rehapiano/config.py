# centrálne konštanty a “dohody” – tu to budeme sústrediť

# rámcové značky
START_0 = 0xA0
START_1 = 0xA2
END_0   = 0xB0
END_1   = 0xB3

# odporúčaný jednotný header do budúcna (FW zatiaľ posiela rôzne poradia)
# type/cmd/len budeme riešiť v parsri
# TODO: keď spevníme protokol, doplniť TYPE kódy, CMD kódy, CRC typ, atď.

# sériové porty – default hodnoty (môžeme upraviť cez CLI neskôr)
DEFAULT_BAUDRATE = 1_000_000
DEFAULT_BYTESIZE = 8
DEFAULT_PARITY   = "N"
DEFAULT_STOPBITS = 1
READ_CHUNK = 2048 # uprava pre verziu 2.2048 (z 512)

# základná metrika pre ADC (informativne; prepočty budú až po parsingu)
U_BIT     = 2.4 / (2**24)     # ~143.05 nV na bit (podľa FW)
AMP_GAIN  = 128               # zosilnenie
