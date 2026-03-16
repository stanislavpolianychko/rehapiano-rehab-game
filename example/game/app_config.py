import configparser

config = configparser.ConfigParser(interpolation=configparser.ExtendedInterpolation())
config.read('app_config.cfg')

# LANGUAGE
LANG = config.get('LANGUAGE', 'LANGUAGE')
