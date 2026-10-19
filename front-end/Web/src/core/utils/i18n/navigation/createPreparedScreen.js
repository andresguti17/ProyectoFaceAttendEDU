// ============================================================
//  FaceAttend EDU — createPreparedScreen
//
//  Factory que wrappea una Screen con PreparedScreen.
//
//  USO en navigators:
//    import { createPreparedScreen } from '...';
//
//    <Stack.Screen
//      name="Students"
//      component={createPreparedScreen(StudentsScreen)}
//    />
//
//  La View real (StudentsScreen) NO necesita modificaciones.
// ============================================================

import React from 'react';
import { PreparedScreen } from '../components/PreparedScreen';

export function createPreparedScreen(Component) {
    // Retornar componente que renderiza PreparedScreen con Component
    return function PreparedRoute(props) {
        return <PreparedScreen component={Component} {...props} />;
    };
}
