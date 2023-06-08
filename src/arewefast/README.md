### Local Development

In order to run the arewefast database modification scripts, you need the following:

- NodeJS (`node`) and Node Package Mananger (`npm`)
- A MySQL installation
    - The development helper scripts `init.sh` and `run.sh` assume passwordless access.
    - The main script `index.js` assumes access with password.
    You can create a test user on your local server by executing
    `CREATE USER 'test'@'localhost' IDENTIFIED WITH mysql_native_password BY 'test';`
    The user can then be granted privileges by executing:
    `GRANT ALL PRIVILEGES ON *.* TO 'test'@'localhost' WITH GRANT OPTION;`


Running `npm install` will install the necessary Node dependencies

Running `init.sh` will create the `flix` database and the necessary tables.

Running `node index.js [options]` will run the main program.

Running `reset.sh` will remove the `flix` database from your installation.
