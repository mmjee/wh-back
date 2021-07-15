FROM node:lts

ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./
COPY index.js ./
COPY warehouse ./warehouse

RUN yarn install
EXPOSE 3000
ENV NODE_PATH=.
CMD ["node", "index.js"]
