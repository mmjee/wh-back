### Backend for Warehouse

This repo contains the backend code for Warehouse.

#### Structure

1. `warehouse/db` - Contains database schema, models, et cetra.
2. `warehouse/routes` - API routes, clearly and cleanly separated by 
3. `warehouse/utils` - Utilities that provide supporting services such as Razorpay, Email, Redis, etc.
4. `warehouse/jobs` - For now, only contains code to deliver codes by email when a order is received, May grow in the future.

#### Stack

Warehouse overall is implemented on a MEVN stack, with some custom libraries including libbetterauth which I developed.

1. [libbetterauth](https://github.com/mmjee/libbetterauth) for authentication
2. [BullMQ](https://docs.bullmq.io/) for job queueing.
3. [Joi](https://joi.dev) for API request validation.
4. [lodash](https://lodash.org) for misc utilities
5. [Mongoose](https://mongoosejs.com/) for database schema and et cetra.

Configuration is conventionally stored in `config.json5` unless `WH_CFG` is set in the environment, in which case it just uses that path.

#### License

Copyright (C) 2021 Maharshi Mukherjee

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
