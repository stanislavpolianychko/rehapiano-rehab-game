import websockets
import asyncio
import time
import rehapiano_data_converter
rhc = rehapiano_data_converter.RehapianoDataConverter()

delta_time_threshold = 0.01
delta_agg = []
async def client():
    async with websockets.connect("ws://localhost:8005",subprotocols=["rehapiano"]) as websocket:
        async for message in websocket:
            # decode raw data to readeble form
            time_stamp_streamer, channel_list = rhc.decode(raw_bytes_array=message)

            # check freeze stream
            time_stamp_local = time.time()
            time_delta = time_stamp_local-time_stamp_streamer
            # print(time_delta)

            # only for testing and debugging
            delta_agg.append(time_delta)
            print(sum(delta_agg)/len(delta_agg))
            # if time_delta > delta_time_threshold:
            #     print("POKAZENEEEEEE")
            #     exit(0)


asyncio.run(client())