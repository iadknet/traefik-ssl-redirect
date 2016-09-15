FROM mhart/alpine-node:4
Maintainer Isaac Stefanek <isaac@iadk.net>

ENV APP_USER node_app
ENV APP_ROOT /node_app

ENV APK_PACKAGES git curl make gcc g++ python linux-headers paxctl libgcc libstdc++
ENV DEL_PACKAGES git curl make gcc g++ python linux-headers paxctl

VOLUME /tmp

RUN npm install -g modclean && \
        mkdir -p ${APP_ROOT} && \
        mkdir /home/${APP_USER} && \
        addgroup -S ${APP_USER} && \
        adduser -S -g ${APP_USER} ${APP_USER}

COPY package.json /tmp/package.json

RUN apk add --update ${APK_PACKAGES} && \
    cd /tmp && \
    npm install && \
    modclean -r && \
    mv /tmp/node_modules ${APP_ROOT}/node_modules && \
    apk del ${DEL_PACKAGES} && \
    rm -rf /usr/include /etc/ssl /usr/share/man /var/cache/apk/* /root/.npm \
    /root/node-gyp /usr/lib/node_modules/npm/man usr/lib/node_modules/npm/doc \
    /usr/lib/node_modules/npm/html

COPY . ${APP_ROOT}
USER ${APP_USER}

WORKDIR ${APP_ROOT}

CMD ["node", "main.js"]
