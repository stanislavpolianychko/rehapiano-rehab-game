import configparser

config = configparser.ConfigParser(interpolation=configparser.ExtendedInterpolation())
config.read('connection_config.cfg')

# DEVICE INFO
DEVICE_NAME = config.get('DEVICE', 'DEVICE_NAME')

# REST API INFO
REST_URL = config.get('REST', 'REST_URL')

# WEBSOCKET INFO
WS_URL = config.get('WEBSOCKET', 'WS_URL')
LOCAL_WS_URL = config.get('WEBSOCKET', 'LOCAL_WS_URL')

# REHAPIANO INFO
RP_URL = config.get('REHAPIANO', 'RP_URL')
LOCAL_RP_URL = config.get('REHAPIANO', 'LOCAL_RP_URL')
RP_INVALID_VAL = float(config.get('REHAPIANO', 'RP_INVALID_VAL'))
