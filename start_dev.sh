#!/bin/bash

set -o allexport
. .env
set +o allexport
NODE_PATH=. npx nodemon -- --trace-warnings --inspect=127.0.0.1 index.js
