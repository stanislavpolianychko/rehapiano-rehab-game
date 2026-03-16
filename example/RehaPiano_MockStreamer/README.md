# RehaPiano_MockStreamer 
Fake/virtual RehaPiano device represented as data streamer with example of websocket client for recive data.

## Getting Started
1.	Clone repo
2.	Create conda environment with dependencies `conda create --name <env> --file requirements.txt`
3.	Run server `sudo python server.py`
4.	Run client (optional) `python client.py`


## How to use

- channels 0 to 7 are keys on up keyboard row `q,w,e,r,t,y,u,i` 
- - channels 8 to 15 are keys on middle keyboard row `a,s,d,f,g,h,j,k`
- if is not press anything on each channel will be send 0.0000000
- if channel was pressed -> channel is activated -> on activated channels are sending value 0.25000000
- if channel is activated and `z` channel is pressed -> on activated channels are sending values 0.500000
- if channel is activated and `x` channel is pressed -> on activated channels are sending values 0.750000
- if channel is activated and `c` channel is pressed -> on activated channels are sending values 1.000000
- if is press `shift` on activated channels wil be send minus/inverted values


## TODO
- include read ENVs for IP and port values