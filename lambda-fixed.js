const axios = require('axios');

async function getCalendar(accessToken, userEmail, { startDate, endDate }) {
  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/calendarview`,
    {
      params: {
        startDateTime: startDate,
        endDateTime: endDate,
        $orderby: 'start/dateTime',
        $select: 'subject,start,end,location,attendees,isOnlineMeeting'
      },
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  return { events: response.data.value };
}

async function getBusySlots(accessToken, { emails, startDate, endDate }) {
  const response = await axios.post(
    'https://graph.microsoft.com/v1.0/me/calendar/getschedule',
    {
      schedules: emails,
      startTime: { dateTime: startDate, timeZone: 'Asia/Tokyo' },
      endTime: { dateTime: endDate, timeZone: 'Asia/Tokyo' },
      availabilityViewInterval: 30
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  
  const busySlots = [];
  response.data.value.forEach(schedule => {
    schedule.scheduleItems.forEach(item => {
      const start = new Date(item.start.dateTime);
      const end = new Date(item.end.dateTime);
      const startHour = start.getHours();
      const endHour = end.getHours();
      
      if ((startHour >= 9 && startHour < 12) || (startHour >= 13 && startHour < 17) ||
          (endHour > 9 && endHour <= 12) || (endHour > 13 && endHour <= 17)) {
        busySlots.push({
          email: schedule.scheduleId,
          start: item.start.dateTime,
          end: item.end.dateTime,
          status: item.status
        });
      }
    });
  });
  
  return { busySlots };
}

async function createEvent(accessToken, userEmail, params) {
  const { subject, startDateTime, endDateTime, requiredAttendees, optionalAttendees, withTeamsMeeting } = params;
  
  const event = {
    subject,
    start: { dateTime: startDateTime, timeZone: 'Asia/Tokyo' },
    end: { dateTime: endDateTime, timeZone: 'Asia/Tokyo' },
    attendees: [
      ...(requiredAttendees || []).map(email => ({ emailAddress: { address: email }, type: 'required' })),
      ...(optionalAttendees || []).map(email => ({ emailAddress: { address: email }, type: 'optional' }))
    ]
  };
  
  if (withTeamsMeeting) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = 'teamsForBusiness';
  }
  
  const response = await axios.post(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/events`,
    event,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  
  return {
    eventId: response.data.id,
    webLink: response.data.webLink,
    onlineMeetingUrl: response.data.onlineMeeting?.joinUrl
  };
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  try {
    // Gateway統合: eventに直接パラメータが入る
    const { toolName, accessToken, userEmail, ...params } = event;
    
    // toolNameからプレフィックスを除去
    const actualTool = (toolName || '').replace('calendar-tools___', '');
    
    let result;
    switch (actualTool) {
      case 'getCalendar':
        result = await getCalendar(accessToken, userEmail, params);
        break;
      case 'getBusySlots':
        result = await getBusySlots(accessToken, params);
        break;
      case 'createEvent':
        result = await createEvent(accessToken, userEmail, params);
        break;
      default:
        throw new Error(`Unknown tool: ${actualTool}`);
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return {
      statusCode: error.response?.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.response?.data?.error?.message || error.message
      })
    };
  }
};
