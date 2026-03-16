from time import time, sleep

class Logger:
    def __init__(self, fname = "events.log"):
        self.logFile = open(fname, "w")
        self.lastTime = time()
        self.eventCounter = 0
        
    def LogEvent(self):
        currentTime = time()
        deltaTime = currentTime - self.lastTime
        if deltaTime >= 1.0:
            frequency = self.eventCounter / deltaTime
            self.logFile.write("{0:.2f}\r\n".format(frequency))
            print(frequency)
            self.lastTime = currentTime
            self.eventCounter = 0
        else:
            self.eventCounter = self.eventCounter + 1
            
    def __del__(self):
        self.logFile.close()
        
def LoggerDemo():
    print("Logging library demo start")
    logger = Logger()
    for _ in range(5000):
        logger.LogEvent()
        sleep(0.004)
    print("Logging library demo end")
    
if __name__ == "__main__":
    from line_profiler import LineProfiler
    profiler = LineProfiler(LoggerDemo, Logger.LogEvent)
    profiler.run("LoggerDemo()")
    profiler.print_stats()
