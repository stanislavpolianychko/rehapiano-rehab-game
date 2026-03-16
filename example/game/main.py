import argparse
import asyncio
import datetime
import logging
import time
import sys

from game import Game
import game_logger
from connection_config import RP_URL, LOCAL_RP_URL

parser = argparse.ArgumentParser()
parser.add_argument(
    "-ws", "--socket", type=str, default="server", choices=["server", "local"],
    help="websocket communication target: server or local"
)
parser.add_argument(
    "-rp", "--rehapiano", type=str, default="local", choices=["model", "local"],
    help="rehapiano streamer target: model or local"
)
args = parser.parse_args()
RP_TARGET = RP_URL if args.rehapiano == "model" else LOCAL_RP_URL


async def main():
    logging.info("Game started at {}".format(datetime.datetime.now()))
    test = Game(args.socket, RP_TARGET)

    await test.start_game()

    try:
        await test.game_logic()
    except Exception as e:
        logging.debug(e)
        await test.connection.close_stream()


asyncio.run(main())
sys.exit()
