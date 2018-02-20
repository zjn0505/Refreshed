# Refreshed

### Get Topics Recommendation

* **URL**

  /topic
  
* **Method**
 
  `GET`

* **URL Params**

| Name | Required | Type | Description |
| ---  | :---:    | ---  | ---         |
|  q   |  *       |String|topics query |

* **Data Params**

  None

* **Success Response**

  * **Code:** 200 <br />
    **Content:** 
```json
[
  {
    "mid": "/m/0cqt90",
    "title": "Donald Trump",
    "type": "45th U.S. President"
  },
  {
    "mid": "/m/013f39m8",
    "title": "Donald Trump presidential campaign, 2016",
    "type": "2016"
  },
  {
    "mid": "/g/11c30wg9n5",
    "title": "Presidency of Donald Trump",
    "type": "Topic"
  },
  {
    "mid": "/m/0g8309",
    "title": "Trump",
    "type": "Card games"
  },
  {
    "mid": "/g/11cm135nm5",
    "title": "Protests against Donald Trump",
    "type": "Topic"
  }
]
```
----

### Request Images

* **URL**

  /images
  
* **Method**
 
  `POST`

* **URL Params**

  None

* **Data Params**
```json
  [
    {
      "type":"source",
      "query":"ESPN"
    },
    {
      "type":"topic",
      "query":"trump"
    }
  ]
```
* **Success Response**

```json
{
    "size": 2,
    "data": [
        {
            "source": "ESPN",
            "imgUrl": "https://logo-core.clearbit.com/espn.com"
        },
        {
            "source": "trump",
            "imgUrl": "https://pmcdeadline2.files.wordpress.com/2017/10/trump1.jpg?w=191&h=128&crop=1"
        }
    ]
}
```

----

### Update One Image

* **URL**

  /update-images
  
* **Method**
 
  `POST`
  
* **Headers**

| Name | Required | Type | Description |
| ---  | :---:    | ---  | ---         |
| x-api-key | *   |String|api keys to update image|

* **URL Params**

| Name | Required | Type | Description |
| ---  | :---:    | ---  | ---         |
| source | *   |String|source or topic name to update|
| url    | *   |String|image url to update|
| type   | *   |String|`source` or `topic`|

* **Data Params**

  None
  
* **Success Response**
  * **Code:** 200 <br />
  
* **Error Response**

  * **Code:** 400 Bad Request <br />
    **Content:** `Invalid request`

  OR

  * **Code:** 401 UNAUTHORIZED <br />
    **Content:** `Invalid keycode`

----

### Get All Images

* **URL**

  /all-images
  
* **Method**
 
  `GET`

* **URL Params**

| Name | Required | Type | Description |
| ---  | :---:    | ---  | ---         |
| type |          |String|`topics` or `sources`|

* **Data Params**

  None

* **Success Response**

  HTML page of all images
