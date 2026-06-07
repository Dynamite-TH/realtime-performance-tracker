# Realtime Performance Tracker

This project is a work in progress real-time performance tracker that will allow users to monitor and analyze their system's performance metrics. It will provide insights into CPU usage, memory consumption, disk activity, and network performance. The tracker is designed to be user-friendly and customizable, enabling users to set thresholds and receive alerts when certain performance metrics exceed predefined limits.

This tracker will be helpful in server settings in a way of monitoring the performance of applications and services, identifying bottlenecks, and optimizing resource allocation. It will also be useful for developers and system administrators to ensure that their applications are running efficiently and to troubleshoot performance issues.

## Technologies Used
 - <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript Badge"/> - the main programming language for the frontend and backend development.
 - <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js Badge"/> - the runtime environment for executing JavaScript on the server-side.
 
## Roadmap
- [x] Implement real-time data collection for different metrics
    - [x] CPU usage
    - [x] Memory consumption
    - [x] Disk activity
    - [ ] Research how to monitor Network performance as not included in os module
- [x] Implement a live server that will have the different requests for the different metrics
- [x] Create a frontend interface to display the performance metrics in real-time
- [ ] Add functionality for users to choose time frames for data visualization (e.g. 5 minutes ago, last hour, last 24 hours)
- [ ] Implement a IndexedDb database to store the performance data locally
### Improved Features
- [ ] Implement data visualization using charts and graphs to make it easier for users to understand the performance metrics
- [ ] Implement a threshold alert system that allows users to set a threshold of different values and the dashboard will show realtime if the value is above or below the threshold and give a email or text alert when the threshold is breached
- [ ] Optimize the performance of the tracker to ensure it does not significantly impact system resources (e.g. optimising data storage by having it average out the raw data every hour and only keep the averaged data for long-term storage)


## Getting started
(Instructions will be added once project is more developed)

## Contact
email: tedhayward@icloud.com
