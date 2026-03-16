import struct


# BYTEARRAY format for RehaPiano protocol streamer
# 8 byte - unix timestamp (milliseconds)
# 4 byte - channel 0 data -1.0f to 1.0f
# 4 byte - channel 1 data -1.0f to 1.0f
# 4 byte - channel 2 data -1.0f to 1.0f
# 4 byte - channel 3 data -1.0f to 1.0f
# 4 byte - channel 4 data -1.0f to 1.0f
# 4 byte - channel 5 data -1.0f to 1.0f
# 4 byte - channel 6 data -1.0f to 1.0f
# 4 byte - channel 7 data -1.0f to 1.0f
# 4 byte - channel 8 data -1.0f to 1.0f
# 4 byte - channel 9 data -1.0f to 1.0f
# 4 byte - channel 10 data -1.0f to 1.0f
# 4 byte - channel 11 data -1.0f to 1.0f
# 4 byte - channel 12 data -1.0f to 1.0f
# 4 byte - channel 13 data -1.0f to 1.0f
# 4 byte - channel 14 data -1.0f to 1.0f
# 4 byte - channel 15 data -1.0f to 1.0f
class RehapianoDataConverter:

    def __init__(self, version=1.0):
        self.version = version

    def encode(self, time_stamp: float, list_of_channels: list) -> bytearray:
        """
        encode function convert readable data to bytes array which is ready to send over websocket.
        :param time_stamp: system time of streamer service in timestamp (unix) format
        :param list_of_channels:
        :return: bytearray which represent aggregation of all encoded data
        """
        bytes_array = bytearray(struct.pack("d", time_stamp))
        for channel in list_of_channels:
            bytes_array = bytes_array + bytearray(struct.pack("f", channel))
        return bytes_array

    def decode(self, raw_bytes_array: bytearray) -> (float, list):
        """
        decode function convert raw data encoded in bytearray to readable values
        :param raw_bytes_array: encoded raw data
        :return: int -> timestamp of packet (batch of data), list -> list of all channels with measured values
        """
        de_time_stamp = struct.unpack("d", raw_bytes_array[0:8])[0]
        de_channel_list = []
        for channel_index in range(0, 16):
            offset = channel_index * 4  # each channel need 4 bytes per float
            de_channel_list.append(struct.unpack("f", raw_bytes_array[8 + offset:8 + 4 + offset])[0])
        return de_time_stamp, de_channel_list
