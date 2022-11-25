#!/usr/bin/env node

import { SpotterPlugin, Option } from '@spotter-app/core';

new class Applications extends SpotterPlugin {

  public spotterOnQuery(query: string): Option[] {
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
