import React from 'react';

export const FooterLoader = () => {
    return (
        <>
            {/* DOCTRINA T.I.L.O.: Aislamiento estricto. 
        Este stylesheet SOLO afecta a los elementos dentro de este componente.
      */}
            <link rel="stylesheet" href="https://equipoenaccion.net/css/loadingEAstyle.css" />

            <div
                id="loader-iso"
                className="!relative !m-0 !p-0 flex items-center justify-center w-full h-full"
            >
                <div className="container text-center flex items-center justify-center !h-auto !m-0 !p-0">
                    <div
                        className='progress flex gap-3 !m-0 !p-0 items-center justify-center'
                    >
                        <span>
                            <svg width='30' aria-hidden='true' focusable='false' data-prefix='fas' data-icon='hexagon' role='img' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512' className='hexagon__CustomSVG-sc-7q3egg-0 jwzatX svg-inline--fa fa-hexagon fa-w-18 fa-2x' transform='rotate(180)'>
                                <path fill='#B70E0C' d='M441.5 39.8C432.9 25.1 417.1 16 400 16H176c-17.1 0-32.9 9.1-41.5 23.8l-112 192c-8.7 14.9-8.7 33.4 0 48.4l112 192c8.6 14.7 24.4 23.8 41.5 23.8h224c17.1 0 32.9-9.1 41.5-23.8l112-192c8.7-14.9 8.7-33.4 0-48.4l-112-192z'></path>
                            </svg>
                        </span>
                        <span>
                            <svg width='30' aria-hidden='true' focusable='false' data-prefix='fas' data-icon='hexagon' role='img' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512' className='hexagon__CustomSVG-sc-7q3egg-0 jwzatX svg-inline--fa fa-hexagon fa-w-18 fa-2x' transform='rotate(180)'>
                                <path fill='#F29FC5' d='M441.5 39.8C432.9 25.1 417.1 16 400 16H176c-17.1 0-32.9 9.1-41.5 23.8l-112 192c-8.7 14.9-8.7 33.4 0 48.4l112 192c8.6 14.7 24.4 23.8 41.5 23.8h224c17.1 0 32.9-9.1 41.5-23.8l112-192c8.7-14.9 8.7-33.4 0-48.4l-112-192z'></path>
                            </svg>
                        </span>
                        <span>
                            <svg width='30' aria-hidden='true' focusable='false' data-prefix='fas' data-icon='hexagon' role='img' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512' className='hexagon__CustomSVG-sc-7q3egg-0 jwzatX svg-inline--fa fa-hexagon fa-w-18 fa-2x' transform='rotate(90)'>
                                <path fill='#1C75BC' d='M441.5 39.8C432.9 25.1 417.1 16 400 16H176c-17.1 0-32.9 9.1-41.5 23.8l-112 192c-8.7 14.9-8.7 33.4 0 48.4l112 192c8.6 14.7 24.4 23.8 41.5 23.8h224c17.1 0 32.9-9.1 41.5-23.8l112-192c8.7-14.9 8.7-33.4 0-48.4l-112-192z'></path>
                            </svg>
                        </span>
                        <span>
                            <svg width='30' aria-hidden='true' focusable='false' data-prefix='fas' data-icon='hexagon' role='img' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512' className='hexagon__CustomSVG-sc-7q3egg-0 jwzatX svg-inline--fa fa-hexagon fa-w-18 fa-2x' transform='rotate(180)'>
                                <path fill='#3AAA35' d='M441.5 39.8C432.9 25.1 417.1 16 400 16H176c-17.1 0-32.9 9.1-41.5 23.8l-112 192c-8.7 14.9-8.7 33.4 0 48.4l112 192c8.6 14.7 24.4 23.8 41.5 23.8h224c17.1 0 32.9-9.1 41.5-23.8l112-192c8.7-14.9 8.7-33.4 0-48.4l-112-192z'></path>
                            </svg>
                        </span>
                        <span>
                            <svg width='30' aria-hidden='true' focusable='false' data-prefix='fas' data-icon='hexagon' role='img' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512' className='hexagon__CustomSVG-sc-7q3egg-0 jwzatX svg-inline--fa fa-hexagon fa-w-18 fa-2x' transform='rotate(180)'>
                                <path fill='#FFCC00' d='M441.5 39.8C432.9 25.1 417.1 16 400 16H176c-17.1 0-32.9 9.1-41.5 23.8l-112 192c-8.7 14.9-8.7 33.4 0 48.4l112 192c8.6 14.7 24.4 23.8 41.5 23.8h224c17.1 0 32.9-9.1 41.5-23.8l112-192c8.7-14.9 8.7-33.4 0-48.4l-112-192z'></path>
                            </svg>
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};
