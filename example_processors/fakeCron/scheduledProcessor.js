
curl --user "KEY" --digest \
  --header "Content-Type: application/json" \
  --header "Accept: application/vnd.atlas.2023-02-01+json" \
  --include \
  --data '{"name": "worldTimeAPI","type": "Https","url": "https://worldtimeapi.org"}' \
  --request POST "https://cloud.mongodb.com/api/atlas/v2/groups/PROJECTID/streams/SPINAME/connections"

s =  {
              $source: {
                connectionName: 'sample_stream_solar',
                timeField: { $dateFromString: { dateString: '$timestamp' }}
            }
        }

 w =       { $tumblingWindow: {
          interval: {size: NumberInt(10), unit: "second"},
                  "pipeline": [ 
                      {
                          $group: {
                              "_id" : null,                                     
                          }
                      }
                  ],
               } 
           }

h = {
  '$https': {
    connectionName: 'worldTimeAPI',
    path : "/api/timezone/America/Detroit",
    method: 'GET',
    headers: { accept: 'application/json' },
    onError: 'dlq',
    as: 'apiResults',
  }
}

sp.process([s,w,h])
{
  _id: null,
  _stream_meta: {
    source: {
      type: 'generated'
    },
    window: {
      start: ISODate('2024-12-19T17:07:40.000Z'),
      end: ISODate('2024-12-19T17:07:50.000Z')
    },
    https: {
      url: 'https://worldtimeapi.org/api/timezone/America/Detroit',
      method: 'GET',
      httpStatusCode: 200,
      responseTimeMs: 60
    }
  },
  apiResults: {
    utc_offset: '-05:00',
    timezone: 'America/Detroit',
    day_of_week: 4,
    day_of_year: 354,
    datetime: '2024-12-19T12:07:53.125662-05:00',
    utc_datetime: '2024-12-19T17:07:53.125662+00:00',
    unixtime: 1734628073,
    raw_offset: -18000,
    week_number: 51,
    dst: false,
    abbreviation: 'EST',
    dst_offset: 0,
    dst_from: null,
    dst_until: null,
    client_ip: '34.237.40.31'
  }
}
{
  _id: null,
  _stream_meta: {
    source: {
      type: 'generated'
    },
    window: {
      start: ISODate('2024-12-19T17:07:50.000Z'),
      end: ISODate('2024-12-19T17:08:00.000Z')
    },
    https: {
      url: 'https://worldtimeapi.org/api/timezone/America/Detroit',
      method: 'GET',
      httpStatusCode: 200,
      responseTimeMs: 21
    }
  },
  apiResults: {
    utc_offset: '-05:00',
    timezone: 'America/Detroit',
    day_of_week: 4,
    day_of_year: 354,
    datetime: '2024-12-19T12:08:03.148542-05:00',
    utc_datetime: '2024-12-19T17:08:03.148542+00:00',
    unixtime: 1734628083,
    raw_offset: -18000,
    week_number: 51,
    dst: false,
    abbreviation: 'EST',
    dst_offset: 0,
    dst_from: null,
    dst_until: null,
    client_ip: '34.237.40.31'
  }
}
