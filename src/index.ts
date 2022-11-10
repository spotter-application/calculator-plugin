#!/usr/bin/env node

import util from 'util';
import { exec } from 'child_process';
import os from 'os';
const asyncExec = util.promisify(exec);
// import { SpotterPlugin, Option } from '@spotter-app/core';


import WebSocket from 'websocket';

async function asyncFindAndMap<T>(
  array: T[],
  asyncCallback: (item: T) => Promise<T>,
) {
  const promises = array.map(asyncCallback);
  const results = await Promise.all(promises);
  const index = results.findIndex(result => result);
  return results[index];
}

export interface Option {
  name: string;
  hint?: string;
  action?: Action;
  onQuery?: OnQuery;
  icon?: string;
  isHovered?: boolean,
  priority?: number,
  important?: boolean,
}

export type OnQuery = (query: string) => Promise<Option[]> | Option[];

export type Action = () => Promise<Option[] | boolean> | Option[] | boolean;

interface MappedOption {
  name: string;
  hint?: string;
  actionId?: string;
  onQueryId?: string;
  icon?: string;
  isHovered?: boolean,
  priority?: number,
  important?: boolean,
};

enum RequestFromSpotterType {
  onQuery = 'onQuery',
  onOptionQuery = 'onOptionQuery',
  execAction = 'execAction',
};

interface RequestFromSpotter {
  id: string,
  type: RequestFromSpotterType,
  query: string,
  actionId: string,
  onQueryId: string,
};

interface RequestFromPlugin {
  id: string,
  options: MappedOption[],
  complete: boolean,
};

const generateId = () => Math.random().toString(16).slice(2);

export class SpotterPlugin {
  private actionsMap: {[actionId: string]: Action} = {};
  private onQueryMap: {[onQueryId: string]: OnQuery} = {};

  constructor() {
    this.spotterInitServer();
  }

  private async spotterInitServer() {
    const client = new WebSocket.client();
    client.connect('ws://0.0.0.0:4040');

    client.on('connect', (cl) => {
      // cl.send(JSON.stringify(response));

      cl.on('message', async (msg: any) => {
        const request: RequestFromSpotter = JSON.parse(msg.utf8Data);
        
        if (request.type === RequestFromSpotterType.onQuery) {
          const nextOptions: Option[] = this.onQuery(request.query);
          const mappedOptions = this.spotterMapOptions(nextOptions);
          const response: RequestFromPlugin = {
            id: request.id,
            options: mappedOptions,
            complete: false,
          };
          cl.send(JSON.stringify(response));
          return;
        }

        if (request.type === RequestFromSpotterType.execAction) {
          const result = await this.actionsMap[request.actionId]();

          // TODO: move to function
          if (typeof result === 'boolean') {
            const response: RequestFromPlugin = {
              id: request.id,
              options: [],
              complete: result,
            };
            cl.send(JSON.stringify(response));
            return;
          };

          const mappedOptions = this.spotterMapOptions(result as Option[]);
          const response: RequestFromPlugin = {
            id: request.id,
            options: mappedOptions,
            complete: false,
          };
          cl.send(JSON.stringify(response));
          return;
        }

        if (request.type === RequestFromSpotterType.onOptionQuery) {
          const nextOptions = await this.onQueryMap[request.onQueryId](request.query);

          console.log(nextOptions);

          if (typeof nextOptions === 'boolean') {
            const response: RequestFromPlugin = {
              id: request.id,
              options: [],
              complete: nextOptions,
            };
            cl.send(JSON.stringify(response));
            return;
          };

          const mappedOptions = this.spotterMapOptions(nextOptions as Option[]);
          const response: RequestFromPlugin = {
            id: request.id,
            options: mappedOptions,
            complete: false,
          };
          cl.send(JSON.stringify(response));
          return;
        }
      });
    });

    client.on('connectFailed', (reason) => {
      console.log('connectFailed: ', reason);
    });
  }

  private spotterMapOptions(options: Option[]): MappedOption[] {
    // TODO: optimize
    // this.actionsMap = {};
    // this.onQueryMap = {};

    return options.map(({
      name,
      hint,
      icon,
      action,
      onQuery,
      isHovered,
      priority,
      important,
    }) => {
      const mappedOption: MappedOption = {
        name: `${name}`,
        hint,
        icon,
        isHovered,
        priority,
        important,
      };

      if (action) {
        const actionId = generateId();
        this.actionsMap[actionId] = action;
        mappedOption.actionId = actionId;
      }

      if (onQuery) {
        const onQueryId = generateId();
        this.onQueryMap[onQueryId] = onQuery;
        mappedOption.onQueryId = onQueryId;
      }

      return mappedOption;
    });
  }

  public onQuery(_: string): Option[] {
    return [];
  }
}



new class Applications extends SpotterPlugin {

  public onQuery(query: string): Option[] {
    const signs = ['-', '+', '/', '*', '%'];
    if (!query.match(/^\d/) || !query.split('').find(i => signs.includes(i))) {
      return [];
    }

    try {
      const result = eval(query);
      return [{ name: result, important: true }];
    } catch {
      return [];
    }
  }

}

