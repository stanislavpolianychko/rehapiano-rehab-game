# Introduction 
RehaPiano game application programmed in Python 3.9 using Pygame.

# Installation
All game-related scripts are available in the `game` folder. Prepare a virtual environment using the `requirements.txt` file [venv](https://docs.python.org/3/library/venv.html) or [in Conda](https://conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html). The app was developed in Anaconda 4.12.0.

# Run application
Start the streamer application [available here](https://dev.azure.com/estensk/RehaPiano/_git/RehaPiano_MockStreamer):

`python server.py`

Start the application by running the script `main.py`:

`python main.py -ws server -rp local`

The `ws` argument can take values `server` for `https://rehapiano.devapp.sk` or `local` for a local server. Both URLs can be set in the `connection_config.py` file.

The `rp` argument can take values `model` for RehaPiano model IP address or `local` for a local mock streamer. Both URLs can be set in the `connection_config.py` file (for now both set to local mock streamer).

You can set up a new examination through [the web app](https://rehapiano.devapp.sk).

# Websocket communication
Websocket communication logic is defined in `communicator.py`. For socket messages refer to [BE documentation](https://dev.azure.com/estensk/RehaPiano/_git/RehaPiano_BE).

You can configure the Websocket connection by editing the `connection_config.cfg` file. Parameters declared:

* `DEVICE_NAME` - name of the RehaPiano device as saved in database;
* `REST_URL` - URL link of the REST API where the device requests access token for websocket communication;
* `WS_URL` - URL to access the web socket server; `DEVICE_NAME` is added automatically.
