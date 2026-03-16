import datetime
import logging

# global logger
# logger = logging.getLogger()

# fh = logging.FileHandler('logs/log_{}.log'.format(datetime.datetime.now()))
# fh.setLevel(logging.DEBUG)
# logger.addHandler(fh)

logging.basicConfig(filename='logs/log_{}.log'.format(datetime.datetime.now()),level=logging.DEBUG)
logging.getLogger("websockets").propagate = False
